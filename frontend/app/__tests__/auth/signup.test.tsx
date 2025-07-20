import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import SignupPage from '../../signup/page'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter } from 'next/navigation'

jest.mock('@/contexts/AuthContext')
jest.mock('next/navigation')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('SignupPage', () => {
  const mockPush = jest.fn()
  const mockSignup = jest.fn()

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
      signup: mockSignup,
      logout: jest.fn(),
      resetPassword: jest.fn(),
      updatePassword: jest.fn(),
      loading: false,
    } as any)
  })

  it('renders signup form with all required fields', () => {
    render(<SignupPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, 'ValidPass123!')
    await user.type(confirmPasswordInput, 'ValidPass123!')
    await user.click(submitButton)

    expect(mockSignup).not.toHaveBeenCalled()
  })

  it('validates password strength', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const passwordInput = screen.getByLabelText(/^password/i)
    
    // Test weak password
    await user.type(passwordInput, 'weak')
    expect(screen.getByText(/weak/i)).toBeInTheDocument()
    
    // Test medium password
    await user.clear(passwordInput)
    await user.type(passwordInput, 'Medium123')
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
    
    // Test strong password
    await user.clear(passwordInput)
    await user.type(passwordInput, 'Strong123!@#')
    expect(screen.getByText(/strong/i)).toBeInTheDocument()
  })

  it('validates password confirmation match', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'ValidPass123!')
    await user.type(confirmPasswordInput, 'DifferentPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
    expect(mockSignup).not.toHaveBeenCalled()
  })

  it('successfully creates account with valid data', async () => {
    const user = userEvent.setup()
    mockSignup.mockResolvedValueOnce(undefined)
    
    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'newuser@example.com')
    await user.type(passwordInput, 'ValidPass123!')
    await user.type(confirmPasswordInput, 'ValidPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('newuser@example.com', 'ValidPass123!')
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('displays error message on signup failure', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Email already exists'
    mockSignup.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<SignupPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(emailInput, 'existing@example.com')
    await user.type(passwordInput, 'ValidPass123!')
    await user.type(confirmPasswordInput, 'ValidPass123!')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('accepts terms and conditions checkbox', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i })
    expect(termsCheckbox).toBeInTheDocument()
    expect(termsCheckbox).not.toBeChecked()

    await user.click(termsCheckbox)
    expect(termsCheckbox).toBeChecked()
  })

  it('redirects to login page when clicking login link', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const loginLink = screen.getByText(/sign in/i)
    await user.click(loginLink)

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('redirects authenticated users to dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      login: jest.fn(),
      signup: mockSignup,
      logout: jest.fn(),
      resetPassword: jest.fn(),
      updatePassword: jest.fn(),
      loading: false,
    } as any)

    render(<SignupPage />)

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
}) 