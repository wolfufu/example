export default function Button({
  children,
  loading = false,
  variant = 'primary',
  ...props
}) {
  return (
    <button
      className={`btn btn--${variant}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? 'Подождите…' : children}
    </button>
  );
}