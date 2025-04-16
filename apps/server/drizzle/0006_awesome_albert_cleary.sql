CREATE TABLE "announcement" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar2(255) NOT NULL,
	"content" text,
	"type" varchar2(20) DEFAULT 'INFO' NOT NULL,
	"published_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
