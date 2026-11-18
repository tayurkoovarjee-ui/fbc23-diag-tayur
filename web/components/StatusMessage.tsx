/** Confirmation text after an action. Screen readers hear it through the live region; sighted users see the green notice. */
export default function StatusMessage({ message }: { message: string }) {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
      {message && (
        <p className="notice" aria-hidden="true">
          {message}
        </p>
      )}
    </>
  );
}
