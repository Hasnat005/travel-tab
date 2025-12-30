-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "expense_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_owed" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("expense_id","user_id")
);

-- CreateTable
CREATE TABLE "ExpensePayer" (
    "expense_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExpensePayer_pkey" PRIMARY KEY ("expense_id","user_id")
);

-- CreateTable
CREATE TABLE "TripLog" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "performed_by" UUID NOT NULL,
    "details" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripMember" (
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "TripMember_pkey" PRIMARY KEY ("trip_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Trip_creator_id_idx" ON "Trip"("creator_id");

-- CreateIndex
CREATE INDEX "Expense_trip_id_idx" ON "Expense"("trip_id");

-- CreateIndex
CREATE INDEX "ExpenseShare_user_id_idx" ON "ExpenseShare"("user_id");

-- CreateIndex
CREATE INDEX "ExpensePayer_user_id_idx" ON "ExpensePayer"("user_id");

-- CreateIndex
CREATE INDEX "TripLog_trip_id_idx" ON "TripLog"("trip_id");

-- CreateIndex
CREATE INDEX "TripLog_performed_by_idx" ON "TripLog"("performed_by");

-- CreateIndex
CREATE INDEX "TripMember_user_id_idx" ON "TripMember"("user_id");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripLog" ADD CONSTRAINT "TripLog_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripLog" ADD CONSTRAINT "TripLog_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripMember" ADD CONSTRAINT "TripMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
