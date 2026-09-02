import { useMemo, useState } from "react";
import { buildGraphIndex, GRAPH_NOTATION_DEFINITIONS, notationForNode } from "../graph";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { Interaction } from "../model";
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
  const [query, setQuery] = useState("");
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const nodeSearchEntries = useMemo(() => {
    const interactionText = new Map<string, string[]>();
    for (const interaction of snapshot.interactions) {
      const values = interactionText.get(interaction.sourceNodeId) ?? [];
      values.push(interaction.wording, ...interaction.aliases);
      interactionText.set(interaction.sourceNodeId, values);
    }
    return snapshot.nodes.map((node) => ({
      node,
      searchText: [
        `#${node.nodeNumber}`,
        String(node.nodeNumber),
        node.text,
        ...(interactionText.get(node.id) ?? []),
      ].join(" ").toLowerCase(),
    }));
  }, [snapshot]);
  const activeNodeId = path.at(-1) ?? playState.currentNodeId;
  const activeNode = snapshot.nodes.find((node) => node.id === activeNodeId);
  const normalizedQuery = query.trim().toLowerCase();
  const jumpResults = useMemo(() => {
    if (!normalizedQuery) return [];
    const numericQuery = normalizedQuery.replace(/^#/, "");
    const exactNumber = /^\d+$/.test(numericQuery) ? Number(numericQuery) : null;
    return nodeSearchEntries
      .filter(({ searchText }) => searchText.includes(normalizedQuery) || (/^#?\d+$/.test(normalizedQuery) && searchText.includes(numericQuery)))
      .map(({ node }) => node)
      .sort((left, right) => {
        if (exactNumber !== null) {
          if (left.nodeNumber === exactNumber && right.nodeNumber !== exactNumber) return -1;
          if (right.nodeNumber === exactNumber && left.nodeNumber !== exactNumber) return 1;
        }
        return left.nodeNumber - right.nodeNumber;
      })
      .slice(0, 12);
  }, [nodeSearchEntries, normalizedQuery]);

  const jumpToNode = (nodeId: string) => {
    setPath([nodeId]);
    setQuery("");
  };

  const returnToCurrent = () => {
    setPath([playState.currentNodeId]);
    setQuery("");
  };

  return <section className="author-panel author-panel-frame structure-panel focused-structure-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>STRUCTURE {activeNode ? `· #${activeNode.nodeNumber}` : ""}</span><button type="button" onClick={() => setLegend((value) => !value)} aria-expanded={legend} aria-label="Show graph notation legend">[?]</button></header>
    <div className="author-panel-body focused-structure-body">
      <div className="structure-navigation-tools">
        <div className="structure-path-bar">
          {path.length > 1 ? <button type="button" className="structure-step-back" aria-label="Back one structure level" onClick={() => setPath(path.slice(0, -1))}>[←]</button> : <span className="structure-step-back-placeholder" />}
          <nav className="structure-path" aria-label="Structure path">
            {path.map((nodeId, index) => {
              const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
              if (!node) return null;
              return <span className="structure-path-step" key={`${nodeId}:${index}`}>
                {index ? <span aria-hidden="true">›</span> : null}
                <button type="button" aria-current={index === path.length - 1 ? "page" : undefined} onClick={() => setPath(path.slice(0, index + 1))}>#{node.nodeNumber}</button>
              </span>;
            })}
          </nav>
          {activeNodeId !== playState.currentNodeId ? <button type="button" className="structure-return-current" onClick={returnToCurrent}>[CURRENT]</button> : null}
        </div>

        <div className="structure-jump-row">
          <label htmlFor="structure-node-search">FIND NODE</label>
          <div className="structure-jump-control">
            <input
              id="structure-node-search"
              type="search"
              value={query}
              placeholder="node text, input, or #"
              onChange={(event) => setQuery(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {query ? <button type="button" aria-label="Clear node search" onClick={() => setQuery("")}>[X]</button> : null}
          </div>
        </div>

        {normalizedQuery ? <div className="structure-jump-results" aria-label="Matching nodes">
          {jumpResults.length ? jumpResults.map((node) => <button type="button" key={node.id} onClick={() => jumpToNode(node.id)}>
            <span className="structure-jump-copy"><strong>#{node.nodeNumber}</strong><small>{node.text.slice(0, 90) || "Empty node"}</small></span>
            <span className="structure-jump-notation">{notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, node.id).join("")}</span>
          </button>) : <span className="structure-jump-empty">NO MATCHING NODES.</span>}
        </div> : null}
      </div>

      {legend ? <dl className="notation-legend structure-notation-legend">{GRAPH_NOTATION_DEFINITIONS.map((item) => <div key={item.token}><dt>{item.token}</dt><dd>{item.meaning}</dd></div>)}</dl> : null}

      <div className="structure-columns">
        {path.map((nodeId, columnIndex) => {
          const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
          if (!node) return null;
          const outgoing = snapshot.interactions.filter((interaction) => interaction.sourceNodeId === nodeId);
          const arrivalSource = columnIndex === 0 ? playState.traversal.at(-2) : path[columnIndex - 1];
          const arrivedBy = arrivalSource ? snapshot.interactions.find((interaction) => interaction.outcomes.some((outcome) => outcome.destinationNodeId === nodeId && interaction.sourceNodeId === arrivalSource)) : null;
          const active = columnIndex === path.length - 1;
          const rootLabel = node.id === playState.currentNodeId ? "CURRENT NODE" : "BROWSED NODE";
          return <section className={`structure-level${active ? " active" : ""}`} key={`${nodeId}:${columnIndex}`}>
            <small className="structure-arrival">{arrivedBy ? `VIA ${arrivedBy.matchMode === "fallback" ? "INVALID INPUT" : arrivedBy.wording || arrivedBy.aliases[0]}` : columnIndex === 0 ? rootLabel : "HERE"}</small>
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
                <div className="structure-branch-head">
                  <span className="structure-input-name">{interaction.matchMode === "fallback" ? "INVALID INPUT" : interaction.wording || interaction.aliases[0]}</span>
                  <button type="button" className="branch-edit" onClick={() => onEditInteraction(interaction)}>[EDIT]</button>
                </div>
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
