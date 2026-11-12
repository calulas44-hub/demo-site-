export function PreviewBanner({ text }: { text: string }) {
  return (
    <div className="preview-banner" role="status">
      <strong>Mode aperçu administrateur</strong> — {text} Les visiteurs ne voient que le contenu publié.
    </div>
  );
}
