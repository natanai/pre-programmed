import { useState } from "react";
import type { AuthorPersist } from "../../../author/features/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { movedInteractionIds, validInteractionsForNode } from "../interactionOrdering";
import type { Interaction } from "../model";

export function NodeInputList({
  snapshot,
  nodeId,
  nodeNumber,
  persist,
  invalidInput,
  onOpenInput,
  onOpenInvalid,
}: {
  snapshot: ProjectSnapshot;
  nodeId: string;
  nodeNumber: number;
  persist: AuthorPersist;
  invalidInput?: Interaction;
  onOpenInput: (interactionId?: string) => void;
  onOpenInvalid: () => void;
}) {
  const [movingId, setMovingId] = useState("");
  const validInputs = validInteractionsForNode(snapshot, nodeId);

  const move = async (interactionId: string, direction: -1 | 1) => {
    if (movingId) return;
    const interactionIds = movedInteractionIds(snapshot, nodeId, interactionId, direction);
    const currentIds = validInputs.map((interaction) => interaction.id);
    if (interactionIds.every((id, index) => id === currentIds[index])) return;
    setMovingId(interactionId);
    try {
      await persist(
        [{ type: "interaction.reorder", sourceNodeId: nodeId, interactionIds }],
        `Reordered valid inputs for node #${nodeNumber}`,
      );
    } finally {
      setMovingId("");
    }
  };

  return <div className="node-input-list">
    {validInputs.map((interaction, index) => <div className="node-input-order-row" key={interaction.id}>
      <button
        type="button"
        className="node-input-link"
        onClick={() => onOpenInput(interaction.id)}
      >
        <span>
          <strong>{interaction.matchMode === "capture" ? "CAPTURE PLAYER INPUT" : interaction.wording || interaction.aliases[0] || "UNTITLED INPUT"}</strong>
          <small>{interaction.outcomes.length} response{interaction.outcomes.length === 1 ? "" : "s"} · Node #{nodeNumber}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      <div className="node-input-order-controls" aria-label="Input order">
        <button
          type="button"
          aria-label={`Move ${interaction.wording || "input"} up`}
          title="Move up"
          disabled={index === 0 || Boolean(movingId)}
          onClick={() => void move(interaction.id, -1)}
        >↑</button>
        <button
          type="button"
          aria-label={`Move ${interaction.wording || "input"} down`}
          title="Move down"
          disabled={index === validInputs.length - 1 || Boolean(movingId)}
          onClick={() => void move(interaction.id, 1)}
        >↓</button>
      </div>
    </div>)}
    <button type="button" className="node-input-link" onClick={() => onOpenInput()}>
      <span><strong>+ VALID INPUT</strong><small>Add player wording that works only at Node #{nodeNumber}.</small></span>
      <span aria-hidden="true">›</span>
    </button>
    <button type="button" className="node-input-link" onClick={onOpenInvalid}>
      <span>
        <strong>{invalidInput ? "INVALID INPUT RESPONSE" : "+ INVALID INPUT RESPONSE"}</strong>
        <small>Only for Node #{nodeNumber}: what happens when player text matches nothing here.</small>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  </div>;
}
