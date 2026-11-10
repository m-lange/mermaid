/**
 * Englische Fassungen der Beispielvorlagen (Label, Beschreibung, Code) je Diagrammtyp-ID.
 * Fehlt ein Eintrag, wird die deutsche Fassung aus templates.ts/templatesV12.ts verwendet.
 *
 * Die Vorlagen entsprechen in Aufbau und Größe den deutschen. IDs, auf die sich
 * Code-Bausteine beziehen (z. B. `MainRequirement`, `intake`, `Dog`), müssen zu den
 * Platzhaltern in snippets.en.ts passen.
 */
export interface LocalizedTemplate {
  label: string;
  description: string;
  template: string;
}

const d = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "") + "\n";

export const EN_TEMPLATES: Record<string, LocalizedTemplate> = {
  flowchart: {
    label: "Flowchart",
    description: "Processes, workflows and decisions",
    template: d(`
---
title: Order process
---
flowchart TB
    start([Order received]) --> check[Check stock]
    check --> stock{In stock?}
    stock -->|Yes| ship[Ship goods]
    stock -->|No| reorder[Reorder]
    reorder -.-> check
    ship --> invoice[(Book invoice)]
    invoice --> finish([Done])

    classDef important fill:#ffcc80,stroke:#e65100,color:#000
    class stock important
`),
  },
  sequence: {
    label: "Sequence diagram",
    description: "Interactions between participants",
    template: d(`
sequenceDiagram
    title Sign-in
    autonumber
    actor U as User
    participant W as Web app
    participant A as API
    participant D as Database

    U->>W: Sign in
    W->>A: POST /login
    A->>D: Find user
    D-->>A: Record
    alt Password correct
        A-->>W: 200 Token
        W-->>U: Home page
    else Password wrong
        A-->>W: 401 Error
        W-->>U: Error message
    end
    Note over U,W: Session active
`),
  },
  class: {
    label: "Class diagram",
    description: "Classes, attributes and relationships (UML)",
    template: d(`
---
title: Animal shelter
---
classDiagram
    class Shelter {
        +String city
        +admit(Animal animal)
    }
    class Animal {
        <<abstract>>
        +String name
        -int age
        +makeSound()* String
    }
    class Dog {
        +fetch()
    }
    class Cat {
        +scratch()
    }

    Shelter "1" *-- "0..*" Animal : houses
    Animal <|-- Dog
    Animal <|-- Cat
`),
  },
  state: {
    label: "State diagram",
    description: "States and transitions",
    template: d(`
---
title: Order handling
---
stateDiagram-v2
    state Check <<choice>>

    [*] --> Ready
    Ready --> Active : start()

    state Active {
        [*] --> Loading
        Loading --> Processing
        Processing --> [*]
    }

    Active --> Check
    Check --> Done : ok
    Check --> Failed : failed
    Failed --> Ready : retry
    Done --> [*]

    classDef warning fill:#ffcdd2,stroke:#c62828,color:#000
    class Failed warning
`),
  },
  er: {
    label: "ER diagram",
    description: "Entities and relationships (data model)",
    template: d(`
---
title: Ordering system
---
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "appears in"

    CUSTOMER {
        int id PK
        string name
        string email UK
    }
    ORDER {
        int id PK
        int customer_id FK
        date created
    }
    LINE_ITEM {
        int quantity
    }
    PRODUCT {
        int id PK
        string title
        decimal price
    }
`),
  },
  requirement: {
    label: "Requirements",
    description: "Requirements and their relationships (SysML)",
    template: d(`
requirementDiagram

    requirement MainRequirement {
        id: 1
        text: "Process orders"
        risk: high
        verifymethod: test
    }
    performanceRequirement ResponseTime {
        id: 1.1
        text: "Response time below 200 ms"
        risk: medium
        verifymethod: analysis
    }
    interfaceRequirement REST_API {
        id: 1.2
        text: "Interface as REST API"
        risk: low
        verifymethod: inspection
    }
    element OrderService {
        type: "Microservice"
    }
    element LoadTest {
        type: "Test case"
    }

    MainRequirement - contains -> ResponseTime
    MainRequirement - derives -> REST_API
    OrderService - satisfies -> REST_API
    LoadTest - verifies -> ResponseTime
`),
  },
  c4: {
    label: "C4 model",
    description: "Software architecture with the C4 model",
    template: d(`
---
config:
  c4:
    c4ShapeMargin: 30
    diagramMarginY: 0
---
C4Context
    title System context – Online banking

    Person(customer, "Retail customer", "Customer with a checking account")
    System_Ext(mail, "E-mail system", "Notifications")

    System_Boundary(bank, "Sample Bank") {
        System(banking, "Online banking", "Accounts and transfers")
        SystemDb(db, "Core banking DB", "Accounts and transactions")
        SystemQueue(queue, "Payment queue", "Asynchronous processing")
    }

    Rel(customer, banking, "Uses", "HTTPS")
    Rel(banking, db, "Reads/writes")
    Rel(banking, queue, "Sends orders")
    Rel(banking, mail, "Sends e-mails")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
`),
  },
  architecture: {
    label: "Architecture",
    description: "Cloud and infrastructure architecture",
    template: d(`
architecture-beta
    group backend(cloud)[Backend]

    service internet(internet)[Internet]
    service gateway(server)[API Gateway] in backend
    service app(server)[Application] in backend
    service db(database)[Database] in backend
    service storage(disk)[File storage] in backend

    internet:R --> L:gateway
    gateway:R --> L:app
    app:R -- L:db
    app:B -- T:storage
`),
  },
  block: {
    label: "Block diagram",
    description: "Blocks with a freely defined layout",
    template: d(`
block-beta
    columns 3
    intake["Input"] space process("Processing")
    space:3
    block:storage:3
        db[("Database")] cache(("Cache")) archive[["Archive"]]
    end

    intake --> process
    process -- "stores" --> db

    classDef blue fill:#bbdefb,stroke:#1565c0,color:#000
    class intake,process blue
`),
  },
  packet: {
    label: "Packet diagram",
    description: "Structure of network packets (bit fields)",
    template: d(`
---
title: UDP header
config:
  packet:
    bitWidth: 22
---
packet-beta
    0-15: "Source port"
    16-31: "Destination port"
    32-47: "Length"
    +16: "Checksum"
    64-95: "Data (variable)"
`),
  },
  gitgraph: {
    label: "Git graph",
    description: "Branches, commits and merges",
    template: d(`
---
title: Release flow
---
gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Dev-1"
    branch feature
    checkout feature
    commit id: "Feature" type: HIGHLIGHT
    checkout develop
    merge feature
    checkout main
    commit id: "Hotfix"
    merge develop id: "Release" tag: "v1.0"
`),
  },
  mindmap: {
    label: "Mindmap",
    description: "Hierarchical collection of ideas",
    template: d(`
mindmap
  root((Project))
    Goals
      Grow revenue
      Retain customers
    Team
      Development
      Design
    Risks
      Budget
`),
  },
  timeline: {
    label: "Timeline",
    description: "Events in chronological order",
    template: d(`
timeline
    title Project history
    section Planning
        Q1 2026 : Kick-off : Concept
        Q2 2026 : Prototype
    section Delivery
        Q3 2026 : Rollout
`),
  },
  kanban: {
    label: "Kanban",
    description: "Task board with columns",
    template: d(`
---
config:
  kanban:
    ticketBaseUrl: 'https://example.com/browse/#TICKET#'
---
kanban
  todo[To do]
    t1[Gather requirements]@{ ticket: PRJ-101, assigned: 'Anna', priority: 'High' }
    t2[Draft design]@{ priority: 'Low' }
  doing[In progress]
    t3[Implementation]@{ ticket: PRJ-102, assigned: 'Ben', priority: 'Very High' }
    t4[Code review]@{ assigned: 'Clara', priority: 'Very Low' }
  done[Done]
    t5[Project setup]@{ ticket: PRJ-100 }
`),
  },
  journey: {
    label: "User journey",
    description: "User experience in steps with ratings",
    template: d(`
journey
    title Online shopping
    section Search
        Find product: 4: Customer
        Compare prices: 3: Customer
    section Buy
        Pay: 2: Customer, Shop
        Delivery: 5: Customer, Courier
`),
  },
  gantt: {
    label: "Gantt",
    description: "Project planning on a timeline",
    template: d(`
---
config:
  gantt:
    useWidth: 760
---
gantt
    title Project plan
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    tickInterval 1week
    weekday monday
    excludes weekends
    todayMarker off

    section Planning
        Requirements   :done, a1, 2026-01-05, 5d
        Concept        :active, a2, after a1, 5d
    section Delivery
        Development    :crit, b1, after a2, 10d
        Testing        :b2, after b1, 5d
        Go-live        :milestone, after b2, 0d
`),
  },
  // ---------------------------------------------------------------- Charts
  pie: {
    label: "Pie chart",
    description: "Parts of a whole",
    template: d(`
---
config:
  pie:
    textPosition: 0.7
---
pie showData
    title Market share 2026
    "Product A" : 42.5
    "Product B" : 27
    "Product C" : 18.3
    "Other" : 12.2
`),
  },
  xychart: {
    label: "XY chart",
    description: "Bar and line charts",
    template: d(`
xychart-beta
    title "Revenue and target, first half"
    x-axis "Month" [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue (k$)" 0 --> 100
    bar [52, 60, 75, 82, 70, 91]
    line [55, 60, 65, 70, 75, 80]
`),
  },
  quadrant: {
    label: "Quadrant chart",
    description: "Assessment in four quadrants",
    template: d(`
quadrantChart
    title Reach and engagement
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 Expand
    quadrant-2 Promote
    quadrant-3 Re-evaluate
    quadrant-4 Improve
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.78, 0.34]
    Campaign D:::focus: [0.75, 0.8]
    classDef focus color: #109060, radius: 10
`),
  },
  sankey: {
    label: "Sankey",
    description: "Flows of quantities between nodes",
    template: d(`
---
config:
  sankey:
    showValues: true
    linkColor: gradient
---
sankey-beta
Solar,Power grid,32.5
Wind,Power grid,45.2
Coal,Power grid,20.1
Power grid,Households,45.3
Power grid,Industry,40.0
Power grid,Transport,12.5
`),
  },
  radar: {
    label: "Radar",
    description: "Multi-dimensional comparison (spider chart)",
    template: d(`
---
title: Skills profile
config:
  radar:
    width: 460
    height: 460
    marginLeft: 100
    marginRight: 100
    marginTop: 50
    marginBottom: 40
---
radar-beta
    axis tech["Technology"], comm["Communication"], team["Teamwork"]
    axis plan["Planning"], crea["Creativity"]
    curve anna["Anna"]{4, 3, 5, 2, 4}
    curve ben["Ben"]{3, 5, 4, 4, 2}
    max 5
`),
  },
  treemap: {
    label: "Treemap",
    description: "Hierarchical values as nested areas",
    template: d(`
treemap-beta
"Revenue by segment"
    "Hardware"
        "Laptops": 50
        "Monitors": 30
    "Software"
        "Licenses": 40:::important
        "Subscriptions": 35
    "Services"
        "Consulting": 25

classDef important fill:#ffcc80,stroke:#e65100,stroke-width:2px
`),
  },
  // ------------------------------------------------------- neu in Mermaid 12
  agentflow: {
    label: "Agent flow",
    description: "AI agents, tools and workflows",
    template: d(`
---
title: Agent flow – Customer support
---
agentflow-beta TB
  request["Customer request"]@{ shape: input }

  flow triage["Triage agent"]
    classify["Classify request"]@{ shape: task }
    lookup["find_customer"]@{ shape: tool }
    check["Unambiguous?"]@{ shape: decision }
    classify --> check
    classify -.- lookup
  end

  flow reply["Reply agent"]
    draft["Draft reply"]@{ shape: task }
    send["Send e-mail"]@{ shape: action }
    draft --> send
  end

  human["Hand over to staff"]@{ shape: stadium }

  request --> classify
  check -- yes --> draft
  check -- no --> human
`),
  },
  swimlane: {
    label: "Swimlane",
    description: "Process with lanes of responsibility",
    template: d(`
swimlane-beta LR
  accTitle: Leave request

  subgraph emp [Employee]
    request[Submit request]
    notice(Receive decision)
  end

  subgraph mgr [Manager]
    review[Review request]
    ok{Approved?}
  end

  subgraph hr [HR department]
    book[[Book leave]]
  end

  request --> review --> ok
  ok -->|Yes| book
  ok -.->|No| notice
  book --> notice

  classDef important fill:#fff2cc,stroke:#d6a500,color:#111
  class ok important
`),
  },
  treeview: {
    label: "Tree view",
    description: "Folder and file structures",
    template: d(`
---
config:
  treeView:
    showIcons: true
---
treeView-beta
    handbook/
        chapters/
            01-introduction.md ## Overview
            02-basics.md :::highlight ## under revision
        images/
            logo.svg
        README.md ## Start here
`),
  },
  eventmodeling: {
    label: "Event modeling",
    description: "Commands, events and read models",
    template: d(`
eventmodeling

tf 01 ui ShoppingCart
tf 02 cmd AddItem
tf 03 evt ItemAdded
tf 04 readmodel CartContents
tf 05 ui Checkout
`),
  },
  ishikawa: {
    label: "Ishikawa",
    description: "Cause-and-effect diagram (fishbone)",
    template: d(`
ishikawa-beta
    Delivery delayed
    People
        Sick leave
        Missing training
    Machine
        Conveyor belt broken
    Method
        Unclear processes
    Material
        Supply shortage
`),
  },
  venn: {
    label: "Venn",
    description: "Sets and their overlaps",
    template: d(`
venn-beta
  title Team skills
  set Domain["Expertise"]:20
  set Tech["Technology"]:18
  set Social["Social skills"]:16
  union Domain,Tech["Analysis"]:5
  union Tech,Social["Support"]:4
  union Domain,Social["Consulting"]:4
  style Domain fill:#4e79a7
  style Tech fill:#f28e2b
`),
  },
  usecase: {
    label: "Use case",
    description: "UML use cases with actors",
    template: d(`
usecase-beta
direction TB
actor Reader("Reader")
actor Staff("Librarian")
systemBoundary lib["Online library"]
  Borrow("Borrow item")
  Search("Search catalog")
  Renew("Extend loan")
  SignIn("Sign in")
end
Reader --> Borrow
Reader --> Search
Staff --> Renew
Borrow ..> : include SignIn
Renew ..> : extend Borrow
`),
  },
  wardley: {
    label: "Wardley map",
    description: "Value chain and evolution stage",
    template: d(`
wardley-beta
title Online bookstore
size [700, 480]

anchor Customer [0.95, 0.60]
component Webshop [0.80, 0.50] (build)
component Payment [0.62, 0.80] (buy)
component Logistics [0.50, 0.68]
component Database [0.30, 0.55]
component Hosting [0.10, 0.85]

Customer -> Webshop
Webshop -> Payment
Webshop -> Logistics
Webshop -> Database
Database -> Hosting

evolve Database 0.80
note "Core product" [0.88, 0.30]
`),
  },
  cynefin: {
    label: "Cynefin",
    description: "Classify problems by complexity",
    template: d(`
cynefin-beta
  title Decisions in IT operations

  complex
    "Explore new product"

  complicated
    "Analyze performance"

  clear
    "Reset password"

  chaotic
    "Fix total outage"

  complex --> complicated : "Pattern found"
  chaotic --> complex : "Stabilized"
`),
  },
  railroad: {
    label: "Syntax diagram",
    description: "Grammar as a railroad diagram",
    template: d(`
railroad-beta
title "Amount of money"

amount = sequence(
    optional(choice(terminal("+"), terminal("-"))),
    oneOrMore(nonterminal("digit")),
    optional(sequence(terminal("."), nonterminal("digit"), nonterminal("digit"))),
    nonterminal("currency")
) ;
currency = choice(terminal("$"), terminal("USD")) ;
`),
  },
  "railroad-ebnf": {
    label: "Syntax (EBNF)",
    description: "Grammar in EBNF notation",
    template: d(`
railroad-ebnf-beta
title "Assignment (EBNF)"

assignment = name , "=" , expression , [ ";" ] ;
expression = term , { ( "+" | "-" ) , term } ;
term ::= number | name | "(" expression ")" ;
`),
  },
  "railroad-abnf": {
    label: "Syntax (ABNF)",
    description: "Grammar in ABNF notation (RFC 5234)",
    template: d(`
railroad-abnf-beta
title "ISO 8601 date (ABNF)"

date = year "-" month "-" day [ "T" time ] ;
month = ( "0" %x31-39 ) / ( "1" %d48-50 ) ;
time = 2DIGIT ":" 2DIGIT *1( ":" 2DIGIT ) ;
`),
  },
  "railroad-peg": {
    label: "Syntax (PEG)",
    description: "Grammar as a parsing expression grammar",
    template: d(`
railroad-peg-beta
title "Function call (PEG)"

Call <- Name "(" Arguments? ")" ;
Arguments <- Expression ("," Expression)* ;
Expression <- Number / Call / Name ;
Name <- !Keyword Letter+ ;
Keyword <- "if" / "else" ;
`),
  },
};
