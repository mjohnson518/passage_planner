import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils/test-utils'
import LoginPage from '../../login/page'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter } from 'next/navigation'

// Mock the modules
jest.mock('../../contexts/AuthContext')
jest.mock('next/navigation')

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('LoginPage', () => {
  const mockPush = jest.fn()
  const mockLogin = jest.fn()

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
      login: mockLogin,
      signup: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      updatePassword: jest.fn(),
      loading: false,
    } as any)
  })

  it('renders login form with all required fields', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Invalid email
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('requires password to be filled', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('successfully logs in with valid credentials', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce(undefined)
    
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('displays error message on login failure', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Invalid email or password'
    mockLogin.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('disables form during submission', async () => {
    const user = userEvent.setup()
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(emailInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
  })

  it('redirects to signup page when clicking signup link', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const signupLink = screen.getByText(/sign up/i)
    await user.click(signupLink)

    expect(mockPush).toHaveBeenCalledWith('/signup')
  })

  it('shows forgot password link and handles click', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const forgotPasswordLink = screen.getByText(/forgot password/i)
    expect(forgotPasswordLink).toBeInTheDocument()

    await user.click(forgotPasswordLink)
    expect(mockPush).toHaveBeenCalledWith('/reset-password')
  })

  it('redirects authenticated users to dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      login: mockLogin,
      signup: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      updatePassword: jest.fn(),
      loading: false,
    } as any)

    render(<LoginPage />)

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
}) 