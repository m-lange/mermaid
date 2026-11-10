import { useMemo } from "react";
import {
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
  makeStyles,
  tokens,
  type MenuProps,
} from "@fluentui/react-components";
import {
  ArrowRoutingRegular,
  ArrowSyncRegular,
  ColorRegular,
  GroupRegular,
  InkStrokeRegular,
  MoreHorizontalRegular,
  PaintBrushRegular,
  PaintBucketRegular,
  ShapesRegular,
} from "@fluentui/react-icons";
import type { FluentIcon } from "@fluentui/react-icons";
import type { BackgroundMode, DiagramOptions, MermaidLook, MermaidTheme } from "../../shared/model";
import { expandSnippet, snippetsFor, type Snippet, type SnippetGroup } from "../../shared/snippets";

const THEMES: { value: MermaidTheme; label: string }[] = [
  { value: "document", label: "Dokument" },
  { value: "default", label: "Standard" },
  { value: "neutral", label: "Neutral" },
  { value: "forest", label: "Wald" },
  { value: "dark", label: "Dunkel" },
  { value: "base", label: "Basis" },
];
const LOOKS: { value: MermaidLook; label: string }[] = [
  { value: "classic", label: "Klassisch" },
  { value: "handDrawn", label: "Handgezeichnet" },
];
const BACKGROUNDS: { value: BackgroundMode; label: string }[] = [
  { value: "white", label: "Weiß" },
  { value: "transparent", label: "Transparent" },
  { value: "theme", label: "Wie Design" },
];

const SNIPPET_BUTTONS: { id: SnippetGroup; icon: FluentIcon; title: string }[] = [
  { id: "nodes", icon: ShapesRegular, title: "Elemente einfügen" },
  { id: "edges", icon: ArrowRoutingRegular, title: "Kanten und Pfeile einfügen" },
  { id: "structure", icon: GroupRegular, title: "Struktur einfügen (Gruppen, Blöcke, Notizen)" },
  { id: "style", icon: PaintBrushRegular, title: "Stile einfügen (Farben, Klassen)" },
  { id: "general", icon: MoreHorizontalRegular, title: "Mehr: Kommentare und Konfiguration" },
];

const useStyles = makeStyles({
  toolbar: { padding: "0", minHeight: "unset", gap: "0", flexWrap: "wrap" },
  list: { maxHeight: "340px", overflowY: "auto", minWidth: "220px", maxWidth: "320px" },
  item: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1px", minWidth: 0 },
  itemLabel: { fontSize: tokens.fontSizeBase300 },
  preview: {
    fontFamily: '"Cascadia Mono", Consolas, monospace',
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
    whiteSpace: "pre",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "280px",
    fontVariantLigatures: "none",
  },
});

interface Props {
  typeId: string | undefined;
  options: DiagramOptions;
  onOptionsChange: (options: DiagramOptions) => void;
  onInsert: (snippet: Snippet) => void;
  onRefreshTheme: () => void;
  disabled?: boolean;
}

/** Eine Symbolleiste für Darstellungsoptionen und Code-Bausteine (nur Symbole, Details im Tooltip/Menü). */
export function EditorToolbar({ typeId, options, onOptionsChange, onInsert, onRefreshTheme, disabled }: Props) {
  const s = useStyles();
  const snippets = useMemo(() => snippetsFor(typeId), [typeId]);
  const labelOf = <T,>(list: { value: T; label: string }[], v: T) => list.find((x) => x.value === v)?.label ?? "";

  const setTheme = (theme: MermaidTheme) =>
    // Dunkles Design braucht einen dunklen Hintergrund
    onOptionsChange({ ...options, theme, background: theme === "dark" && options.background === "white" ? "theme" : options.background });

  /** Radio-Menü für eine Option */
  const optionMenu = <T extends string>(
    name: string,
    title: string,
    Icon: FluentIcon,
    list: { value: T; label: string }[],
    value: T,
    onChange: (v: T) => void,
    extra?: React.ReactNode,
    isDisabled?: (v: T) => boolean,
  ) => {
    const onCheckedValueChange: MenuProps["onCheckedValueChange"] = (_, d) => onChange(d.checkedItems[0] as T);
    return (
      <Menu checkedValues={{ [name]: [value] }} onCheckedValueChange={onCheckedValueChange}>
        <MenuTrigger disableButtonEnhancement>
          <Tooltip content={`${title}: ${labelOf(list, value)}`} relationship="label" withArrow>
            <ToolbarButton icon={<Icon />} disabled={disabled} data-testid={`toolbar-${name}`} />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuGroup>
              <MenuGroupHeader>{title}</MenuGroupHeader>
              {list.map((o) => (
                <MenuItemRadio key={o.value} name={name} value={o.value} disabled={isDisabled?.(o.value)}>
                  {o.label}
                </MenuItemRadio>
              ))}
            </MenuGroup>
            {extra}
          </MenuList>
        </MenuPopover>
      </Menu>
    );
  };

  const snippetMenu = ({ id, icon: Icon, title }: (typeof SNIPPET_BUTTONS)[number]) => {
    const items = snippets.filter((sn) => sn.group === id);
    if (!items.length) return null;
    const inline = items.filter((i) => !i.frontmatter);
    const frontmatter = items.filter((i) => i.frontmatter);
    const renderItem = (sn: Snippet) => (
      <MenuItem key={sn.label} onClick={() => onInsert(sn)}>
        <div className={s.item}>
          <span className={s.itemLabel}>{sn.label}</span>
          <span className={s.preview}>{previewOf(sn)}</span>
        </div>
      </MenuItem>
    );
    return (
      <Menu key={id} positioning="below-start">
        <MenuTrigger disableButtonEnhancement>
          <Tooltip content={title} relationship="label" withArrow>
            <ToolbarButton icon={<Icon />} disabled={disabled} data-snippet-group={id} />
          </Tooltip>
        </MenuTrigger>
        <MenuPopover>
          <MenuList className={s.list}>
            {inline.length > 0 && frontmatter.length > 0 ? (
              <>
                <MenuGroup>
                  <MenuGroupHeader>An der Cursorposition</MenuGroupHeader>
                  {inline.map(renderItem)}
                </MenuGroup>
                <MenuGroup>
                  <MenuGroupHeader>Konfiguration (Frontmatter)</MenuGroupHeader>
                  {frontmatter.map(renderItem)}
                </MenuGroup>
              </>
            ) : (
              items.map(renderItem)
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
    );
  };

  return (
    <Toolbar className={s.toolbar} size="small" aria-label="Editor-Werkzeuge">
      {optionMenu(
        "theme",
        "Design",
        ColorRegular,
        THEMES,
        options.theme,
        setTheme,
        <>
          <MenuDivider />
          <MenuItem icon={<ArrowSyncRegular />} onClick={onRefreshTheme}>
            Design aus Dokument neu einlesen
          </MenuItem>
        </>,
      )}
      {optionMenu("look", "Darstellung", InkStrokeRegular, LOOKS, options.look, (look) => onOptionsChange({ ...options, look }))}
      {optionMenu(
        "background",
        "Hintergrund",
        PaintBucketRegular,
        BACKGROUNDS,
        options.background,
        (background) => onOptionsChange({ ...options, background }),
        undefined,
        (v) => v === "white" && options.theme === "dark",
      )}
      <ToolbarDivider />
      {SNIPPET_BUTTONS.map(snippetMenu)}
    </Toolbar>
  );
}

function previewOf(sn: Snippet): string {
  const code = expandSnippet(sn.code).replace(/\t/g, "  ");
  const lines = code.split("\n");
  return lines.length > 1 ? `${lines[0]} …` : lines[0];
}
