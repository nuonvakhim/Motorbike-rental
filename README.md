# Cambodia Motorbike Rental

A motorbike and scooter rental site for Cambodia, built with Next.js 16 (App Router), Prisma 7 and PostgreSQL.

- **Tourists** browse cities, rental shops and bikes without an account, then sign up to book a bike and leave reviews.
- **Shop owners** manage their shops, bikes and bike photos from `/owner`.
- **Admins** oversee the site from `/admin`.

## Requirements

- Node.js 20.19 or newer
- A PostgreSQL database. It can run on your own machine, or you can get a free hosted one with `npx create-db`.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a `.env` file

Create `.env` in the project root with these two values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME"
SESSION_SECRET="<random string, at least 32 characters>"
```

- `DATABASE_URL` is the connection string for your PostgreSQL database.
- `SESSION_SECRET` is the key used to sign login cookies. You can generate one with either command:

  ```bash
  openssl rand -base64 32
  # or, if you don't have openssl (e.g. on Windows):
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

`.env` is in `.gitignore`. Never commit it.

### 3. Set up the database

```bash
npx prisma migrate deploy   # create the tables from prisma/migrations
npx prisma generate         # build the Prisma client into lib/generated/prisma
npx prisma db seed          # add demo cities, shops, bikes and accounts
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

The seed creates these accounts. They all share one password, which `npx prisma db seed` prints in the terminal (it's set in `prisma/seed.ts`).

| Role    | Email                                    |
| ------- | ---------------------------------------- |
| Admin   | `admin@example.com`                      |
| Owner   | `owner@example.com`                      |
| Tourist | `tourist@example.com`                    |

There are more owners and tourists in the `users` list in `prisma/seed.ts`.

## Scripts

| Command                 | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Start the development server                  |
| `npm run build`         | Build for production                          |
| `npm run start`         | Run the production build                      |
| `npm run lint`          | Run ESLint                                    |
| `npx prisma studio`     | Browse and edit the database in your browser  |
| `npx prisma migrate dev` | Create a new migration after editing `prisma/schema.prisma` |

After changing `prisma/schema.prisma`, run `npx prisma migrate dev` and then `npx prisma generate`.

## Project structure

```
app/          Pages, layouts, Server Actions and Route Handlers
components/   UI components
lib/          Data access, auth/session and helpers
prisma/       Schema, migrations and seed script
proxy.ts      Redirects visitors who aren't signed in away from protected pages (Next.js 16's renamed middleware)
note/         Next.js study notes
```

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Prisma documentation](https://www.prisma.io/docs)
