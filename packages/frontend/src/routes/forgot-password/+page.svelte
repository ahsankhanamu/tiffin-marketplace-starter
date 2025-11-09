<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Card from '$lib/ui/Card.svelte';
  import OtpInput from '$lib/ui/OtpInput.svelte';
  import { forgotPassword, verifyOtp, resetPassword } from '$lib/api';
  import { cn } from '$lib/cn';
  
  type Step = 'email' | 'otp' | 'reset';
  
  let step = $state<Step>('email');
  let email = $state('');
  let otp = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);
  
  async function handleEmailSubmit() {
    error = '';
    success = '';
    loading = true;
    try {
      await forgotPassword(email);
      success = 'OTP sent to your email. Please check your inbox.';
      step = 'otp';
    } catch (err: any) {
      error = err.error || 'Failed to send OTP. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  async function handleOtpComplete(enteredOtp: string) {
    otp = enteredOtp;
    error = '';
    success = '';
    loading = true;
    try {
      await verifyOtp(email, otp);
      success = 'OTP verified successfully. Please set your new password.';
      step = 'reset';
    } catch (err: any) {
      error = err.error || 'Invalid OTP. Please try again.';
      otp = '';
    } finally {
      loading = false;
    }
  }
  
  async function handleResetSubmit() {
    error = '';
    success = '';
    
    if (newPassword.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    loading = true;
    try {
      await resetPassword(email, otp, newPassword);
      success = 'Password reset successfully! Redirecting to login...';
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (err: any) {
      error = err.error || 'Failed to reset password. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  function handleOtpChange(value: string) {
    otp = value;
  }
</script>

<div class={cn('flex min-h-screen items-center justify-center p-4')}>
  <Card className={cn('w-full max-w-md p-6')}>
    <h1 class={cn('text-2xl font-bold mb-6')}>Forgot Password</h1>
    
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    {#if success}
      <div class={cn('mb-4 p-3 rounded-md bg-green-500/10 text-green-600 text-sm')}>
        {success}
      </div>
    {/if}
    
    {#if step === 'email'}
      <form onsubmit={(e) => { e.preventDefault(); handleEmailSubmit(); }} class={cn('space-y-4')}>
        <div>
          <Label for="email">Email</Label>
          <Input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            required
            disabled={loading}
            class={cn('mt-1')}
          />
        </div>
        
        <Button type="submit" disabled={loading} class={cn('w-full')}>
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </Button>
      </form>
    {:else if step === 'otp'}
      <div class={cn('space-y-4')}>
        <div>
          <Label>Enter OTP</Label>
          <p class={cn('text-sm text-muted-foreground mt-1 mb-4')}>
            We've sent a 6-digit code to {email}
          </p>
          <OtpInput
            length={6}
            disabled={loading}
            onComplete={handleOtpComplete}
            onChange={handleOtpChange}
          />
        </div>
        
        <div class={cn('flex gap-2')}>
          <Button
            variant="outline"
            onclick={() => { step = 'email'; error = ''; success = ''; }}
            class={cn('flex-1')}
          >
            Back
          </Button>
          <Button
            onclick={() => handleOtpComplete(otp)}
            disabled={loading || otp.length !== 6}
            class={cn('flex-1')}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
        
        <p class={cn('text-center text-sm text-muted-foreground')}>
          Didn't receive the code?{' '}
          <button
            type="button"
            onclick={handleEmailSubmit}
            class={cn('text-primary underline')}
          >
            Resend
          </button>
        </p>
      </div>
    {:else if step === 'reset'}
      <form onsubmit={(e) => { e.preventDefault(); handleResetSubmit(); }} class={cn('space-y-4')}>
        <div>
          <Label for="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            bind:value={newPassword}
            placeholder="••••••••"
            required
            minlength="6"
            disabled={loading}
            class={cn('mt-1')}
          />
        </div>
        
        <div>
          <Label for="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            placeholder="••••••••"
            required
            minlength="6"
            disabled={loading}
            class={cn('mt-1')}
          />
        </div>
        
        <Button type="submit" disabled={loading} class={cn('w-full')}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>
    {/if}
    
    <p class={cn('mt-4 text-center text-sm text-muted-foreground')}>
      Remember your password?{' '}
      <a href="/login" class={cn('text-primary underline')}>
        Login
      </a>
    </p>
  </Card>
</div>

