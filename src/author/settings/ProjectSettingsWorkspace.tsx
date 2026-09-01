import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../features/types";
import type { AuthorTaskRoute } from "../tasks/types";
import "./projectSettings.css";

export function ProjectSettingsWorkspace({
  route,
  sections,
  context,
}: {
  route: Extract<AuthorTaskRoute, { type: "feature" }>;
  sections: readonly AuthorProjectSettingsSection[];
  context: AuthorWorkspaceContext;
}) {
  const ordered = [...sections].sort((left, right) => (left.order ?? 100) - (right.order ?? 100) || left.label.localeCompare(right.label));
  const sectionId = route.data?.section;
  const active = ordered.find((section) => section.id === sectionId);

  if (active) {
    return <section className="author-panel author-panel-frame project-settings-workspace">
      <header><span>ADVANCED PROJECT SETTINGS · {active.label}</span></header>
      <div className="author-panel-body project-settings-section-body">
        <p className="project-settings-description">{active.description}</p>
        {active.render(context)}
      </div>
    </section>;
  }

  return <section className="author-panel author-panel-frame project-settings-workspace">
    <header><span>ADVANCED PROJECT SETTINGS</span><span>{ordered.length} SECTIONS</span></header>
    <div className="author-panel-body project-settings-index">
      <p className="project-settings-intro">
        Project-wide engine configuration. Personal display/accessibility preferences stay in Display Settings.
      </p>
      <div className="project-settings-section-list">
        {ordered.map((section) => <button
          type="button"
          key={section.id}
          onClick={() => context.pushTask({
            type: "feature",
            feature: "project",
            workspace: "settings",
            data: { section: section.id },
          })}
        >
          <span><strong>{section.label}</strong><small>{section.description}</small></span>
          <span aria-hidden="true">›</span>
        </button>)}
      </div>
    </div>
  </section>;
}
