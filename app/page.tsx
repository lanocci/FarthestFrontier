import { GoalBoard } from "@/components/goal-board";
import { LoginPanel } from "@/components/login-panel";
import { MaterialsPanel } from "@/components/materials-panel";
import { PlayerList } from "@/components/player-list";
import { Section } from "@/components/section";
import { SetupPanel } from "@/components/setup-panel";
import {
  countActivePlayers,
  countGoalsSubmittedToday,
  countSharedMaterials,
} from "@/lib/utils";

const today = "2026-04-14";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Flag Football Team Hub</span>
        <h1>目標をえらぶ、のこす、みんなで伸びる。</h1>
        <p>
          小学生のフラッグフットボールチーム向けに、練習の目標設定と資料共有をひとつにまとめたMVPです。低学年でも使いやすいように、文字入力ではなく選ぶ操作を中心にしています。
        </p>

        <div className="stats">
          <div className="stat-card">
            <strong>{countActivePlayers()}</strong>
            <span>在籍中の選手</span>
          </div>
          <div className="stat-card">
            <strong>{countGoalsSubmittedToday(today)}</strong>
            <span>今日の目標登録</span>
          </div>
          <div className="stat-card">
            <strong>{countSharedMaterials()}</strong>
            <span>共有資料</span>
          </div>
        </div>

        <div className="hero-grid">
          <LoginPanel />
          <SetupPanel />
        </div>
      </section>

      <div className="dashboard">
        <div className="stack">
          <Section
            title="選手一覧"
            copy="在籍状態の切り替え、保護者情報、最近の目標が見える前提です。次の段階で追加・削除フォームをつなげられます。"
          >
            <div className="toolbar">
              <input type="search" placeholder="選手名で検索" aria-label="選手名で検索" />
              <select aria-label="学年帯">
                <option>全学年</option>
                <option>低学年</option>
                <option>中学年</option>
                <option>高学年</option>
              </select>
              <button className="button secondary" type="button">
                選手を追加
              </button>
            </div>
            <PlayerList />
          </Section>

          <Section
            title="共有資料"
            copy="Google Slides / SheetsのURLを管理画面で登録して、閲覧権限はGoogle側でも制御する想定です。"
          >
            <MaterialsPanel />
          </Section>
        </div>

        <Section
          title="今日の目標"
          copy="選手本人が画面を見ながら選んでも、保護者やコーチが代わりに選んでも運用できるようにしています。"
        >
          <GoalBoard />
        </Section>
      </div>
    </main>
  );
}
