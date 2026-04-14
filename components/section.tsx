type SectionProps = {
  title: string;
  copy: string;
  children: React.ReactNode;
};

export function Section({ title, copy, children }: SectionProps) {
  return (
    <section className="panel">
      <div className="panel-body">
        <h2 className="section-title">{title}</h2>
        <p className="section-copy">{copy}</p>
        {children}
      </div>
    </section>
  );
}
