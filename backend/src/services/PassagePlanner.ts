import { EventEmitter } from 'events'
import pino from 'pino'

import type { OrchestrationPlan } from './RequestRouter'

type PlannerDeps = {
  agentRegistry: {
    execute(agentId: string, tool: string, args: any): Promise<any>
  }
  aggregator: {
    addStepResult(step: string, result: any): void
    buildSummary(request: any, steps: any[]): any
  }
  persistence: {
    savePassagePlan(plan: any): Promise<{ id: string }>
  }
  metrics: {
    record(event: string, metadata: Record<string, any>): Promise<void> | void
  }
  emitter: EventEmitter
  logger: pino.Logger
}

export class PassagePlanner {
  constructor(private readonly deps: PlannerDeps) {}

  async run(plan: OrchestrationPlan, requestArgs: any) {
    const results: Record<string, any> = {}

    try {
      for (const step of plan.steps) {
        this.deps.emitter.emit('request:progress', {
          requestId: plan.requestId,
          step: step.agent,
          status: 'running',
        })

        const result = await this.deps.agentRegistry.execute(step.agent, step.tool, requestArgs)
        results[step.agent] = result

        this.deps.aggregator.addStepResult(step.agent, result)

        this.deps.emitter.emit('request:progress', {
          requestId: plan.requestId,
          step: step.agent,
          status: 'completed',
        })
      }

      const summary = this.deps.aggregator.buildSummary(requestArgs, plan.steps.map((s) => ({ key: s.agent })))
      const persisted = await this.deps.persistence.savePassagePlan({
        requestId: plan.requestId,
        userId: plan.userId,
        summary,
        raw: results,
      })

      await this.deps.metrics.record('passage_planned', {
        userId: plan.userId,
        planId: persisted.id,
      })

      this.deps.emitter.emit('planning:completed', {
        requestId: plan.requestId,
        planId: persisted.id,
        summary,
      })

      return {
        success: true,
        planId: persisted.id,
        summary,
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      await this.deps.metrics.record('passage_failed', {
        userId: plan.userId,
        reason,
      })

      this.deps.emitter.emit('planning:error', {
        requestId: plan.requestId,
        error: reason,
      })

      return {
        success: false,
        planId: plan.id,
        summary: { error: reason },
      }
    }
  }
}

