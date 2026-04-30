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
