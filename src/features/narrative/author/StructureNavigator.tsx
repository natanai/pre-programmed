import { useMemo, useState } from "react";
import { buildGraphIndex, GRAPH_NOTATION_DEFINITIONS, notationForNode } from "../../../game/graph";
import type { Interaction, PlayState, ProjectSnapshot } from "../../../game/model";
import "./structureNavigator.css";

export function StructureNavigator({ snapshot, playState, onOpenNode, onEditInteraction, onClose: _onClose }: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  onOpenNode: (nodeId: string) => void;
  onEditInteraction: (interaction: Interaction) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState([playState.currentNodeId]);
  const [legend, setLegend] = useState(false);
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const activeNodeId = path.at(-1) ?? playState.currentNodeId;
  const activeNode = snapshot.nodes.find((node) => node.id === activeNodeId);

  return <section className="author-panel author-panel-frame structure-panel focused-structure-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>STRUCTURE {activeNode ? `· #${activeNode.nodeNumber}` : ""}</span><button type="button" onClick={() => setLegend((value) => !value)} aria-expanded={legend}>[?]</button></header>
    <div className="author-panel-body focused-structure-body">
      {legend ? <dl className="notation-legend">{GRAPH_NOTATION_DEFINITIONS.map((item) => <div key={item.token}><dt>{item.token}</dt><dd>{item.meaning}</dd></div>)}</dl> : null}

      <div className="structure-mobile-nav">
        {path.length > 1 ? <button type="button" onClick={() => setPath(path.slice(0, -1))}>[← BACK]</button> : <span />}
        <span>DEPTH {path.length}</span>
      </div>

      <div className="structure-columns">
        {path.map((nodeId, columnIndex) => {
          const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
          if (!node) return null;
          const outgoing = snapshot.interactions.filter((interaction) => interaction.sourceNodeId === nodeId);
          const arrivalSource = columnIndex === 0 ? playState.traversal.at(-2) : path[columnIndex - 1];
          const arrivedBy = arrivalSource ? snapshot.interactions.find((interaction) => interaction.outcomes.some((outcome) => outcome.destinationNodeId === nodeId && interaction.sourceNodeId === arrivalSource)) : null;
          const active = columnIndex === path.length - 1;
          return <section className={`structure-level${active ? " active" : ""}`} key={`${nodeId}:${columnIndex}`}>
            <small className="structure-arrival">{arrivedBy ? `VIA ${arrivedBy.matchMode === "fallback" ? "INVALID INPUT" : arrivedBy.wording || arrivedBy.aliases[0]}` : columnIndex === 0 ? "CURRENT PATH" : "HERE"}</small>
            <button type="button" className="structure-node" onClick={() => onOpenNode(node.id)}>
              <span>#{node.nodeNumber} {node.text.slice(0, 70)}</span>
              <strong>{notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, node.id).join("")}</strong>
            </button>
            <div className="structure-level-meta">
              <span>{outgoing.length} input{outgoing.length === 1 ? "" : "s"}</span>
              {node.ending ? <span>[E] ENDING</span> : null}
            </div>
            <div className="structure-branches">
              {outgoing.map((interaction) => <div className="structure-branch" key={interaction.id}>
                <button type="button" className="branch-edit" onClick={() => onEditInteraction(interaction)}>[EDIT]</button>
                <span className="structure-input-name">{interaction.matchMode === "fallback" ? "INVALID INPUT" : interaction.wording || interaction.aliases[0]}</span>
                <div className="structure-outcomes">
                  {interaction.outcomes.map((outcome, outcomeIndex) => {
                    const destination = outcome.destinationNodeId && snapshot.nodes.find((candidate) => candidate.id === outcome.destinationNodeId);
                    if (!destination) return <span className="stay-destination" key={outcome.id}>{outcomeIndex + 1}. ↺ stay</span>;
                    return <button type="button" className="branch-destination" key={outcome.id} onClick={() => setPath([...path.slice(0, columnIndex + 1), destination.id])}>
                      <span>{outcomeIndex + 1}. → #{destination.nodeNumber} {destination.text.slice(0, 46)}</span>
                      <strong>{notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, destination.id).join("")}</strong>
                    </button>;
                  })}
                </div>
              </div>)}
              {!outgoing.length ? <span className="structural-warning">No interactions from this node.</span> : null}
            </div>
          </section>;
        })}
      </div>
    </div>
  </section>;
}
