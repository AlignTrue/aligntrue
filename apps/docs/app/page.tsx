const REDIRECT_PATH = "/docs";

export default function HomeRedirectPage() {
  return (
    <div className="p-6 text-center">
      <p className="text-lg font-medium">Documentation moved.</p>
      <p className="text-sm text-gray-500">
        Continue to <a href={REDIRECT_PATH}>/docs</a>.
      </p>
    </div>
  );
}
