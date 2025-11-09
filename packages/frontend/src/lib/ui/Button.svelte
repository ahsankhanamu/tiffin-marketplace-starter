<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'icon';
    variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'destructive' | 'link';
    [key: string]: unknown;
  }
  
  let { 
    type = 'button', 
    class: className = '', 
    disabled = false, 
    size = 'md',
    variant = 'primary', 
    ...rest 
  }: Props = $props();
  
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-sm hover:shadow-md',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90 border border-border',
    tertiary: 'bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/90',
    outline: 'border-2 border-input bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95 shadow-sm hover:shadow-md',
    link: 'text-primary underline-offset-4 hover:underline p-0 h-auto'
  };
  
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10 p-0'
  };
</script>

<button 
  class={cn(
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
    variant !== 'link' && 'min-w-[80px]',
    variants[variant] || variants.primary,
    sizes[size],
    className
  )} 
  type={type}
  disabled={disabled}
  {...rest}
>
  <slot />
</button>
