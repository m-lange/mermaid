import { useMemo, useState } from "react";
import {
  Button,
  Caption1,
  Input,
  Subtitle2,
  Tooltip,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import { SearchRegular } from "@fluentui/react-icons";
import { DIAGRAM_TYPES, type DiagramTypeDef } from "../../shared/templates";
import { iconFor } from "../icons";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: "14px" },
  section: { display: "flex", flexDirection: "column", gap: "8px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
    gap: "6px",
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "6px",
    height: "auto",
    minHeight: "78px",
    padding: "10px 4px 8px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    textAlign: "center",
    ":hover": {
      border: `1px solid ${tokens.colorBrandStroke1}`,
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  tileIcon: { fontSize: "26px", color: tokens.colorBrandForeground1 },
  chartIcon: { color: tokens.colorPaletteBerryForeground2 },
  empty: { color: tokens.colorNeutralForeground3 },
});

interface Props {
  disabled?: boolean;
  onInsert: (type: DiagramTypeDef) => void;
}

export function Gallery({ disabled, onInsert }: Props) {
  const s = useStyles();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return DIAGRAM_TYPES;
    return DIAGRAM_TYPES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [filter]);

  const renderGroup = (title: string, category: DiagramTypeDef["category"]) => {
    const items = filtered.filter((t) => t.category === category);
    if (!items.length) return null;
    return (
      <div className={s.section}>
        <Subtitle2>{title}</Subtitle2>
        <div className={s.grid}>
          {items.map((t) => {
            const Icon = iconFor(t.id);
            return (
              <Tooltip key={t.id} content={`${t.description} (${t.keywords[0]})`} relationship="description" withArrow>
                <Button
                  className={s.tile}
                  appearance="subtle"
                  disabled={disabled}
                  onClick={() => onInsert(t)}
                  data-type={t.id}
                >
                  <Icon className={mergeClasses(s.tileIcon, category === "chart" && s.chartIcon)} />
                  <span>{t.label}</span>
                </Button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={s.root}>
      <Input
        contentBefore={<SearchRegular />}
        placeholder="Diagrammtyp suchen …"
        value={filter}
        onChange={(_, d) => setFilter(d.value)}
        size="small"
        aria-label="Diagrammtyp suchen"
      />
      {renderGroup("Diagramme", "diagram")}
      {renderGroup("Charts", "chart")}
      {!filtered.length && <Caption1 className={s.empty}>Kein passender Diagrammtyp gefunden.</Caption1>}
    </div>
  );
}
