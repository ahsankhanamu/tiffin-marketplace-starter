<script lang="ts">
  import { cn } from '$lib/cn';
  import { onMount } from 'svelte';
  
  interface Props {
    length?: number;
    value?: string;
    className?: string;
    disabled?: boolean;
    onComplete?: (otp: string) => void;
    onChange?: (otp: string) => void;
  }
  
  let {
    length = 6,
    value = '',
    className = '',
    disabled = false,
    onComplete,
    onChange
  }: Props = $props();
  
  let inputs = $state<HTMLInputElement[]>([]);
  let otpValues = $state<string[]>(Array(length).fill(''));
  
  $effect(() => {
    if (value && value.length === length) {
      otpValues = value.split('');
    }
  });
  
  function handleInput(index: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const inputValue = target.value.slice(-1); // Only take the last character
    
    if (!/^\d*$/.test(inputValue)) {
      target.value = otpValues[index] || '';
      return;
    }
    
    otpValues[index] = inputValue;
    
    // Move to next input if value entered
    if (inputValue && index < length - 1) {
      inputs[index + 1]?.focus();
    }
    
    // Move to previous input if backspace and empty
    if (!inputValue && index > 0) {
      inputs[index - 1]?.focus();
    }
    
    const otp = otpValues.join('');
    onChange?.(otp);
    
    if (otp.length === length) {
      onComplete?.(otp);
    }
  }
  
  function handleKeyDown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputs[index - 1]?.focus();
    }
  }
  
  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, length);
    
    digits.split('').forEach((digit, i) => {
      if (i < length) {
        otpValues[i] = digit;
      }
    });
    
    const otp = otpValues.join('');
    onChange?.(otp);
    
    if (otp.length === length) {
      onComplete?.(otp);
      inputs[length - 1]?.focus();
    } else {
      inputs[digits.length]?.focus();
    }
  }
  
  function focusFirst() {
    inputs[0]?.focus();
  }
  
  $effect(() => {
    if (inputs[0]) {
      focusFirst();
    }
  });
</script>

<div class={cn('flex gap-2 justify-center', className)}>
  {#each Array(length) as _, i}
    <input
      bind:this={inputs[i]}
      type="text"
      inputmode="numeric"
      maxlength="1"
      value={otpValues[i]}
      disabled={disabled}
      oninput={(e) => handleInput(i, e)}
      onkeydown={(e) => handleKeyDown(i, e)}
      onpaste={handlePaste}
      class={cn(
        'w-12 h-12 text-center text-lg font-semibold rounded-md border border-input bg-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors'
      )}
    />
  {/each}
</div>

