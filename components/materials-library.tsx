"use client";

import { MaterialsPanel } from "@/components/materials-panel";
import { Section } from "@/components/section";
import { Material } from "@/lib/types";

type MaterialsLibraryProps = {
  materials: Material[];
  teamMessage: string | null;
};

export function MaterialsLibrary({
  materials,
  teamMessage,
}: MaterialsLibraryProps) {
  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="資料室"
          copy="チームで共有している資料をここから見られます。練習メニューや案内資料をまとめて確認できます。"
        >
          <div className="status-strip">
            <span className="chip">資料 {materials.length}件</span>
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
          </div>

          <MaterialsPanel materials={materials} />
        </Section>
      </div>
    </div>
  );
}
