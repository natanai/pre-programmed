import { useMemo, useState } from "react";
import { buildGraphIndex, GRAPH_NOTATION_DEFINITIONS, notationForNode } from "../game/graph";
import type { Interaction, PlayState, ProjectSnapshot } from "../game/model";

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
  const visiblePath = path;
  return <section className="author-panel author-panel-frame structure-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>STRUCTURE FROM HERE</span><button type="button" onClick={() => setLegend((value) => !value)}>[?]</button></header>
    <div className="author-panel-body">
    {legend ? <dl className="notation-legend">{GRAPH_NOTATION_DEFINITIONS.map((item) => <div key={item.token}><dt>{item.token}</dt><dd>{item.meaning}</dd></div>)}</dl> : null}
    <div className="structure-mobile-nav">{path.length > 1 ? <button type="button" onClick={() => setPath(path.slice(0, -1))}>[← BACK]</button> : null}<span>LEVEL {path.length}</span></div>
    <div className="structure-columns">
      {visiblePath.map((nodeId, columnIndex) => {
        const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
        if (!node) return null;
        const outgoing = snapshot.interactions.filter((interaction) => interaction.sourceNodeId === nodeId);
        const arrivalSource = columnIndex === 0 ? playState.traversal.at(-2) : path[columnIndex - 1];
        const arrivedBy = arrivalSource ? snapshot.interactions.find((interaction) => interaction.outcomes.some((outcome) => outcome.destinationNodeId === nodeId && interaction.sourceNodeId === arrivalSource)) : null;
        return <section className={`structure-level${columnIndex === path.length - 1 ? " active" : ""}`} key={`${nodeId}:${columnIndex}`}>
          <small>{arrivedBy ? `VIA ${arrivedBy.wording || arrivedBy.aliases[0]}` : "HERE"}</small>
          <button type="button" className="structure-node" onClick={() => onOpenNode(node.id)}><span>#{node.nodeNumber} {node.text.slice(0, 70)}</span><strong>{notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, node.id).join("")}</strong></button>
          <div className="structure-branches">
            {outgoing.map((interaction) => <div className="structure-branch" key={interaction.id}>
              <button type="button" className="branch-edit" onClick={() => onEditInteraction(interaction)}>[EDIT]</button>
              <span>{interaction.wording || interaction.aliases[0]}</span>
              {interaction.outcomes.map((outcome) => {
                const destination = outcome.destinationNodeId && snapshot.nodes.find((candidate) => candidate.id === outcome.destinationNodeId);
                if (!destination) return <span className="stay-destination" key={outcome.id}>↺ stay</span>;
                return <button type="button" className="branch-destination" key={outcome.id} onClick={() => setPath([...path.slice(0, columnIndex + 1), destination.id])}><span>→ #{destination.nodeNumber} {destination.text.slice(0, 46)}</span><strong>{notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, destination.id).join("")}</strong></button>;
              })}
            </div>)}
            {!outgoing.length ? <span className="structural-warning">No interactions from this node.</span> : null}
          </div>
        </section>;
      })}
    </div>
    </div>
  </section>;
}
