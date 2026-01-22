import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login portal when unauthenticated', () => {
  render(<App />);
  const title = screen.getByText(/Loan Intake Portal/i);
  expect(title).toBeInTheDocument();
  const signInButton = screen.getByText(/Sign in with Microsoft/i);
  expect(signInButton).toBeInTheDocument();
});
