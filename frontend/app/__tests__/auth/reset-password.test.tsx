import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import ResetPasswordPage from '../../reset-password/page'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter } from 'next/navigation'

jest.mock('../../contexts/AuthContext')
jest.mock('next/navigation')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('ResetPasswordPage', () => {
  const mockPush = jest.fn()
  const mockResetPassword = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    } as any)

    mockUseAuth.mockReturnValue({
      user: null,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      resetPassword: mockResetPassword,
      updatePassword: jest.fn(),
      loading: false,
    } as any)
  })

  it('renders password reset form', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    expect(screen.getByText(/remember your password/i)).toBeInTheDocument()
  })

  it('validates email format before submission', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)

    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('successfully sends reset password email', async () => {
    const user = userEvent.setup()
    mockResetPassword.mockResolvedValueOnce(undefined)
    
    render(<ResetPasswordPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'forgot@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('forgot@example.com')
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  it('displays error message on reset failure', async () => {
    const user = userEvent.setup()
    const errorMessage = 'User not found'
    mockResetPassword.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<ResetPasswordPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'notfound@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('disables form during submission', async () => {
    const user = userEvent.setup()
    mockResetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<ResetPasswordPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(emailInput).toBeDisabled()
  })

  it('redirects to login page when clicking back to login', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    const loginLink = screen.getByText(/back to login/i)
    await user.click(loginLink)

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows resend option after successful submission', async () => {
    const user = userEvent.setup()
    mockResetPassword.mockResolvedValueOnce(undefined)
    
    render(<ResetPasswordPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /send reset link/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/didn't receive/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
    })
  })
}) 