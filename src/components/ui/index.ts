// Composants d'interface partagés (docs/DESIGN.md).
// Tous sont purs (sans "use client") : utilisables dans les composants serveur et client.
export { Icon, type IconName } from "./icon";
export { cx } from "./cx";
export { PageHeader, Breadcrumbs, type Crumb } from "./page-header";
export {
  StatusBadge,
  AssessmentStatusBadge,
  ASSESSMENT_STATUS,
  type StatusTone,
  type AssessmentStatusValue,
} from "./status-badge";
export { DeadlineChip } from "./deadline-chip";
export { EmptyState } from "./empty-state";
export { MilestoneSteps, type StepMilestone, type MilestoneStatus } from "./milestone-steps";
export { Tabs, type TabItem } from "./tabs";
export { Swatch } from "./swatch";
