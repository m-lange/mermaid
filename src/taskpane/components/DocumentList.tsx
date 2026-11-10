import {
  Badge,
  Button,
  Caption1,
  Spinner,
  Subtitle2,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular, DeleteRegular, EditRegular } from "@fluentui/react-icons";
import type { DiagramRecord } from "../../shared/model";
import { getDiagramType } from "../../shared/templates";
import { iconFor } from "../icons";

export interface ListEntry {
  record: DiagramRecord;
  /** Anzahl der Elemente im Dokument, die auf diese UUID verweisen */
  occurrences: number;
  location?: string;
}

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: "6px" },
  rows: { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "232px", overflowY: "auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  icon: { fontSize: "20px", color: tokens.colorBrandForeground1, flexShrink: 0 },
  text: { display: "flex", flexDirection: "column", minWidth: 0, flexGrow: 1 },
  title: {
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  meta: { color: tokens.colorNeutralForeground3 },
  empty: { color: tokens.colorNeutralForeground3 },
});

interface Props {
  entries: ListEntry[] | null;
  loading: boolean;
  onRefresh: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentList({ entries, loading, onRefresh, onEdit, onDelete }: Props) {
  const s = useStyles();
  return (
    <div className={s.root}>
      <div className={s.header}>
        <Subtitle2>In diesem Dokument</Subtitle2>
        <Tooltip content="Liste aktualisieren" relationship="label">
          <Button size="small" appearance="subtle" icon={loading ? <Spinner size="extra-tiny" /> : <ArrowClockwiseRegular />} onClick={onRefresh} />
        </Tooltip>
      </div>
      {entries && entries.length === 0 && <Caption1 className={s.empty}>Noch keine Mermaid-Diagramme vorhanden.</Caption1>}
      <div className={s.rows}>
      {entries?.map(({ record, occurrences, location }) => {
        const type = getDiagramType(record.type);
        const Icon = iconFor(record.type);
        const title = firstTitle(record.code) || type?.label || record.type;
        const modified = record.modified ? new Date(record.modified).toLocaleString() : "";
        return (
          <div className={s.row} key={record.id}>
            <Icon className={s.icon} />
            <div className={s.text}>
              <span className={s.title} title={title}>
                {title}
              </span>
              <Caption1 className={s.meta}>
                {[type?.label, location, modified].filter(Boolean).join(" · ")}
              </Caption1>
            </div>
            {occurrences === 0 ? (
              <>
                <Tooltip content="Die Diagrammdaten sind gespeichert, aber im Dokument existiert kein zugehöriges Element mehr." relationship="description">
                  <Badge appearance="tint" color="warning" size="small">
                    verwaist
                  </Badge>
                </Tooltip>
                <Tooltip content="Diagrammdaten löschen" relationship="label">
                  <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => onDelete(record.id)} />
                </Tooltip>
              </>
            ) : (
              <>
                {occurrences > 1 && (
                  <Tooltip content={`${occurrences} Elemente teilen sich diesen Code`} relationship="description">
                    <Badge appearance="tint" size="small">
                      {occurrences}×
                    </Badge>
                  </Tooltip>
                )}
                <Tooltip content="Auswählen und bearbeiten" relationship="label">
                  <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => onEdit(record.id)} />
                </Tooltip>
              </>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function firstTitle(code: string): string | undefined {
  const m = /^\s*title:?\s+["']?(.+?)["']?\s*$/m.exec(code);
  return m?.[1];
}
