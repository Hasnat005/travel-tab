This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Setup (Auth + Postgres)

1) Create a Supabase project

- In the Supabase dashboard, create a new project.
- In **Authentication → Providers**, ensure **Email** is enabled.

2) Configure environment variables

- Copy `.env.local.example` to `.env.local` and fill in values from **Project Settings → API**:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3) Configure Auth redirect URLs

- In **Authentication → URL Configuration** set:
	- **Site URL**: `http://localhost:3000`
	- **Redirect URLs**: add `http://localhost:3000/auth/callback`

4) Run the app

```bash
npm run dev
```

5) Try auth

- Sign up at `http://localhost:3000/signup`
- Log in at `http://localhost:3000/login`
- Visit the protected page at `http://localhost:3000/account`

## Database Operations

Once env vars are set, server components and route handlers can access Postgres via the Supabase client.
Example (server-side): use `createSupabaseServerClient()` and then `supabase.from("your_table").select("*")`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
