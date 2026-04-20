"use client";

import type { ClipForm } from "@/components/video-room/types";
import type { FilmRoomVideo, Player, PositionMaster } from "@/lib/types";

type VideoClipEditorProps = {
  activePlayers: Player[];
  availableFormations: string[];
  availablePenaltyTypes: string[];
  availablePlayTypes: string[];
  canManageTeam: boolean;
  clipForm: ClipForm;
  editingClipId: string | null;
  filmRoomVideos: FilmRoomVideo[];
  formationListId: string;
  inline?: boolean;
  onAddClipPlayerLink: () => void;
  onRemoveClipPlayerLink: (index: number) => void;
  onReset: (targetVideoId: string) => void;
  onSave: () => void;
  onUpdateClipForm: <Key extends keyof ClipForm>(key: Key, value: ClipForm[Key]) => void;
  onUpdateClipPlayerLink: (index: number, key: "playerId" | "positionId", value: string) => void;
  penaltyTypeListId: string;
  playTypeListId: string;
  positionMasters: PositionMaster[];
  syncing: boolean;
  targetVideoId: string;
};

export function VideoClipEditor({
  activePlayers,
  availableFormations,
  availablePenaltyTypes,
  availablePlayTypes,
  canManageTeam,
  clipForm,
  editingClipId,
  filmRoomVideos,
  formationListId,
  inline = false,
  onAddClipPlayerLink,
  onRemoveClipPlayerLink,
  onReset,
  onSave,
  onUpdateClipForm,
  onUpdateClipPlayerLink,
  penaltyTypeListId,
  playTypeListId,
  positionMasters,
  syncing,
  targetVideoId,
}: VideoClipEditorProps) {
  return (
    <div className={inline ? "film-inline-editor" : "admin-form"}>
      <label className="field-stack">
        <span className="field-label">対象動画</span>
        <select
          value={clipForm.videoId}
          onChange={(event) => onUpdateClipForm("videoId", event.target.value)}
          disabled={syncing || !filmRoomVideos.length || inline}
        >
          {filmRoomVideos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field-stack">
        <span className="field-label">プレータイトル</span>
        <input
          type="text"
          placeholder="例: 左ショートパス"
          value={clipForm.title}
          onChange={(event) => onUpdateClipForm("title", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
      </label>
      <label className="field-stack">
        <span className="field-label">開始時刻</span>
        <input
          type="text"
          placeholder="例: 1:24"
          value={clipForm.startText}
          onChange={(event) => onUpdateClipForm("startText", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
      </label>
      <label className="field-stack">
        <span className="field-label">終了時刻</span>
        <input
          type="text"
          placeholder="例: 1:37"
          value={clipForm.endText}
          onChange={(event) => onUpdateClipForm("endText", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
      </label>
      <label className="field-stack">
        <span className="field-label">ダウン</span>
        <select
          value={clipForm.down}
          onChange={(event) => onUpdateClipForm("down", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        >
          <option value="">未指定</option>
          <option value="1">1st ダウン</option>
          <option value="2">2nd ダウン</option>
          <option value="3">3rd ダウン</option>
          <option value="4">4th ダウン</option>
          <option value="0">TFP</option>
        </select>
      </label>
      <label className="field-stack">
        <span className="field-label">To Go Yard</span>
        <input
          type="text"
          placeholder="例: 8"
          value={clipForm.toGoYards}
          onChange={(event) => onUpdateClipForm("toGoYards", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
      </label>
      <label className="field-stack">
        <span className="field-label">反則の種類</span>
        <input
          type="text"
          list={penaltyTypeListId}
          placeholder="候補から選ぶか自由入力"
          value={clipForm.penaltyType}
          onChange={(event) => onUpdateClipForm("penaltyType", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
        <datalist id={penaltyTypeListId}>
          {availablePenaltyTypes.map((penaltyType) => (
            <option key={penaltyType} value={penaltyType}>
              {penaltyType}
            </option>
          ))}
        </datalist>
      </label>
      <label className="field-stack">
        <span className="field-label">隊形</span>
        <input
          type="text"
          list={formationListId}
          placeholder="候補から選ぶか自由入力"
          value={clipForm.formation}
          onChange={(event) => onUpdateClipForm("formation", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
        <datalist id={formationListId}>
          {availableFormations.map((formation) => (
            <option key={formation} value={formation}>
              {formation}
            </option>
          ))}
        </datalist>
      </label>
      <label className="field-stack">
        <span className="field-label">プレー種類</span>
        <input
          type="text"
          list={playTypeListId}
          placeholder="候補から選ぶか自由入力"
          value={clipForm.playType}
          onChange={(event) => onUpdateClipForm("playType", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
        <datalist id={playTypeListId}>
          {availablePlayTypes.map((playType) => (
            <option key={playType} value={playType}>
              {playType}
            </option>
          ))}
        </datalist>
      </label>
      <div className="field-stack admin-form-full">
        <span className="field-label">出場選手</span>
        <div className="film-player-link-list">
          {clipForm.playerLinks.map((link, index) => (
            <div key={`player-link-${index}`} className="film-player-link-row">
              <select
                value={link.playerId}
                onChange={(event) => onUpdateClipPlayerLink(index, "playerId", event.target.value)}
                disabled={syncing || !filmRoomVideos.length}
              >
                <option value="">選手を選ぶ</option>
                {activePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} #{player.jerseyNumber}
                  </option>
                ))}
              </select>
              <select
                value={link.positionId ?? ""}
                onChange={(event) => onUpdateClipPlayerLink(index, "positionId", event.target.value)}
                disabled={syncing || !filmRoomVideos.length}
              >
                <option value="">ポジション未指定</option>
                {positionMasters.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.label}
                  </option>
                ))}
              </select>
              <button
                className="button secondary button-compact"
                type="button"
                onClick={() => onRemoveClipPlayerLink(index)}
                disabled={syncing || !filmRoomVideos.length}
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          className="button secondary button-compact"
          type="button"
          onClick={onAddClipPlayerLink}
          disabled={syncing || !filmRoomVideos.length}
        >
          選手を追加
        </button>
      </div>
      <label className="field-stack admin-form-full">
        <span className="field-label">コメント</span>
        <textarea
          className="form-textarea"
          placeholder="見てほしいポイントや修正点"
          value={clipForm.comment}
          onChange={(event) => onUpdateClipForm("comment", event.target.value)}
          disabled={syncing || !filmRoomVideos.length}
        />
      </label>
      {canManageTeam ? (
        <label className="field-stack admin-form-full">
          <span className="field-label">コーチ間コメント</span>
          <textarea
            className="form-textarea"
            placeholder="コーチ間だけで共有したい観点や次回へのメモ"
            value={clipForm.coachComment}
            onChange={(event) => onUpdateClipForm("coachComment", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
      ) : null}
      <div className="card-actions admin-form-full">
        <button className="button" type="button" onClick={onSave} disabled={syncing || !filmRoomVideos.length}>
          {editingClipId ? "変更を保存" : "プレーを追加"}
        </button>
        {editingClipId ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => onReset(targetVideoId)}
            disabled={syncing}
          >
            キャンセル
          </button>
        ) : null}
      </div>
    </div>
  );
}
