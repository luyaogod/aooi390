-- CreateTable
CREATE TABLE "gzcb_t" (
    "gzcb001" INTEGER NOT NULL,
    "gzcb002" TEXT NOT NULL,
    "gzcb003" TEXT,
    "gzcb004" TEXT,
    "gzcb005" TEXT,
    "gzcb006" TEXT,
    "gzcb007" TEXT,
    "gzcb008" TEXT,
    "gzcb009" TEXT,
    "gzcb010" TEXT,
    "gzcb011" TEXT,
    "gzcb012" TEXT,
    "gzcb013" TEXT,
    "gzcb014" TEXT,
    "gzcb015" TEXT,
    "gzcbud001" TEXT,
    "gzcbud002" TEXT,
    "gzcbud003" TEXT,
    "gzcbud004" TEXT,
    "gzcbud005" TEXT,
    "gzcbud006" TEXT,
    "gzcbud007" TEXT,
    "gzcbud008" TEXT,
    "gzcbud009" TEXT,
    "gzcbud010" TEXT,
    "gzcbud011" REAL,
    "gzcbud012" REAL,
    "gzcbud013" REAL,
    "gzcbud014" REAL,
    "gzcbud015" REAL,
    "gzcbud016" REAL,
    "gzcbud017" REAL,
    "gzcbud018" REAL,
    "gzcbud019" REAL,
    "gzcbud020" REAL,
    "gzcbud021" DATETIME,
    "gzcbud022" DATETIME,
    "gzcbud023" DATETIME,
    "gzcbud024" DATETIME,
    "gzcbud025" DATETIME,
    "gzcbud026" DATETIME,
    "gzcbud027" DATETIME,
    "gzcbud028" DATETIME,
    "gzcbud029" DATETIME,
    "gzcbud030" DATETIME,

    PRIMARY KEY ("gzcb001", "gzcb002")
);

-- CreateTable
CREATE TABLE "gzcbl_t" (
    "gzcbl001" INTEGER NOT NULL,
    "gzcbl002" TEXT NOT NULL,
    "gzcbl003" TEXT NOT NULL,
    "gzcbl004" TEXT,
    "gzcbl005" TEXT,
    "gzcbl006" TEXT,
    "gzcbl007" TEXT,

    PRIMARY KEY ("gzcbl001", "gzcbl002", "gzcbl003")
);

-- CreateTable
CREATE TABLE "gzsy_t" (
    "gzsy001" TEXT NOT NULL,
    "gzsy002" TEXT NOT NULL,
    "gzsy003" TEXT,
    "gzsy004" TEXT NOT NULL,
    "gzsy005" TEXT,
    "gzsyud001" TEXT,
    "gzsyud002" TEXT,
    "gzsyud003" TEXT,
    "gzsyud004" TEXT,
    "gzsyud005" TEXT,
    "gzsyud006" TEXT,
    "gzsyud007" TEXT,
    "gzsyud008" TEXT,
    "gzsyud009" TEXT,
    "gzsyud010" TEXT,
    "gzsyud011" REAL,
    "gzsyud012" REAL,
    "gzsyud013" REAL,
    "gzsyud014" REAL,
    "gzsyud015" REAL,
    "gzsyud016" REAL,
    "gzsyud017" REAL,
    "gzsyud018" REAL,
    "gzsyud019" REAL,
    "gzsyud020" REAL,
    "gzsyud021" DATETIME,
    "gzsyud022" DATETIME,
    "gzsyud023" DATETIME,
    "gzsyud024" DATETIME,
    "gzsyud025" DATETIME,
    "gzsyud026" DATETIME,
    "gzsyud027" DATETIME,
    "gzsyud028" DATETIME,
    "gzsyud029" DATETIME,
    "gzsyud030" DATETIME,

    PRIMARY KEY ("gzsy001", "gzsy002", "gzsy004")
);

-- CreateTable
CREATE TABLE "gzsz_t" (
    "gzszstus" TEXT,
    "gzsz001" TEXT NOT NULL,
    "gzsz002" TEXT NOT NULL,
    "gzsz003" TEXT,
    "gzsz004" TEXT,
    "gzsz005" INTEGER,
    "gzsz006" TEXT,
    "gzsz007" TEXT,
    "gzsz008" TEXT,
    "gzsz009" TEXT,
    "gzsz010" TEXT,
    "gzsz011" TEXT,
    "gzsz012" TEXT,
    "gzszownid" TEXT,
    "gzszowndp" TEXT,
    "gzszcrtid" TEXT,
    "gzszcrtdp" TEXT,
    "gzszcrtdt" DATETIME,
    "gzszmodid" TEXT,
    "gzszmoddt" DATETIME,
    "gzsz013" TEXT,
    "gzsz014" TEXT,
    "gzsz015" TEXT,
    "gzsz016" INTEGER,
    "gzsz017" TEXT,
    "gzsz018" TEXT,
    "gzsz019" TEXT,

    PRIMARY KEY ("gzsz001", "gzsz002")
);

-- CreateTable
CREATE TABLE "gzszl_t" (
    "gzszl001" TEXT NOT NULL,
    "gzszl002" TEXT NOT NULL,
    "gzszl003" TEXT NOT NULL,
    "gzszl004" TEXT,
    "gzszl005" TEXT,
    "gzszl006" TEXT,
    "gzszl007" TEXT,

    PRIMARY KEY ("gzszl001", "gzszl002", "gzszl003")
);

-- CreateTable
CREATE TABLE "gzza_t" (
    "gzzastus" TEXT,
    "gzza001" TEXT NOT NULL PRIMARY KEY,
    "gzza002" TEXT,
    "gzza003" TEXT,
    "gzza004" TEXT,
    "gzza005" TEXT,
    "gzza006" TEXT,
    "gzza007" INTEGER,
    "gzza008" TEXT,
    "gzza009" TEXT,
    "gzza010" TEXT,
    "gzza011" TEXT,
    "gzza012" TEXT,
    "gzza013" TEXT,
    "gzza014" INTEGER,
    "gzza015" TEXT,
    "gzza016" TEXT,
    "gzzaownid" TEXT,
    "gzzaowndp" TEXT,
    "gzzacrtid" TEXT,
    "gzzacrtdp" TEXT,
    "gzzacrtdt" DATETIME,
    "gzzamodid" TEXT,
    "gzzamoddt" DATETIME,
    "gzza017" TEXT,
    "gzza018" TEXT,
    "gzza019" TEXT,
    "gzza020" TEXT,
    "gzza021" TEXT,
    "gzza022" TEXT,
    "gzza023" TEXT,
    "gzza024" INTEGER
);

-- CreateTable
CREATE TABLE "gzzal_t" (
    "gzzal001" TEXT NOT NULL,
    "gzzal002" TEXT NOT NULL,
    "gzzal003" TEXT,
    "gzzal004" TEXT,
    "gzzal005" TEXT,
    "gzzal006" TEXT,

    PRIMARY KEY ("gzzal001", "gzzal002")
);

-- CreateTable
CREATE TABLE "gzzj_t" (
    "gzzj001" TEXT NOT NULL PRIMARY KEY,
    "gzzj002" TEXT,
    "gzzj003" TEXT,
    "gzzjownid" TEXT,
    "gzzjowndp" TEXT,
    "gzzjcrtid" TEXT,
    "gzzjcrtdp" TEXT,
    "gzzjcrtdt" DATETIME,
    "gzzjmodid" TEXT,
    "gzzjmoddt" DATETIME,
    "gzzjstus" TEXT
);

-- CreateTable
CREATE TABLE "gzzol_t" (
    "gzzol001" TEXT NOT NULL,
    "gzzol002" TEXT NOT NULL,
    "gzzol003" TEXT,
    "gzzol004" TEXT,

    PRIMARY KEY ("gzzol001", "gzzol002")
);

-- CreateTable
CREATE TABLE "gzzz_t" (
    "gzzzstus" TEXT,
    "gzzz001" TEXT NOT NULL PRIMARY KEY,
    "gzzz002" TEXT,
    "gzzz003" INTEGER,
    "gzzz004" TEXT,
    "gzzzownid" TEXT,
    "gzzzowndp" TEXT,
    "gzzzcrtid" TEXT,
    "gzzzcrtdp" TEXT,
    "gzzzcrtdt" DATETIME,
    "gzzzmodid" TEXT,
    "gzzzmoddt" DATETIME,
    "gzzz005" TEXT,
    "gzzz006" TEXT,
    "gzzz007" TEXT,
    "gzzz008" TEXT,
    "gzzz009" TEXT,
    "gzzz010" TEXT,
    "gzzz011" TEXT
);
