import { Material } from "@/lib/types";
import { formatAudience, formatMaterialType } from "@/lib/utils";

type MaterialsPanelProps = {
  materials: Material[];
};

export function MaterialsPanel({ materials }: MaterialsPanelProps) {
  if (!materials.length) {
    return <p className="empty-state">まだ資料がありません。Google資料のURLを追加するとここに並びます。</p>;
  }

  return (
    <div className="grid-cards">
      {materials.map((material) => (
        <article className="doc-card" key={material.id}>
          <div className="doc-row">
            <div>
              <strong>{material.title}</strong>
              <div className="subtle">{material.description}</div>
            </div>
            <a className="button ghost" href={material.url} target="_blank" rel="noreferrer">
              ひらく
            </a>
          </div>
          <div className="chip-row">
            <span className="chip">{formatMaterialType(material)}</span>
            <span className={`chip ${material.audience === "all" ? "ok" : "warn"}`}>
              {formatAudience(material)}
            </span>
            <span className="chip">更新: {material.updatedAt}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
