/* SQL Syntax written specifically for PostgreSQL

   SELECT articles for a users in DESC order, then allow for manual
   ordering of those articles if there are 3 day one articles, per say
*/
SELECT a."articleId","articleDayReceived",current_date - b."createdAt"::date as "daysRegistered"
FROM "Articles" a
inner join "Users" b on current_date - b."createdAt"::date >= "articleDayReceived"
Where b."id" = 1 and "isArchived" = false
Order By "articleDayReceived" DESC, "articleOrder" ASC;


/* For a user to create the notifications (future functionality)
   This ensures we are ONLY selecting articles once for each user
*/
SELECT "UUID", "username", a."articleId", "articleDayReceived", current_date - b."createdAt"::date as "daysRegistered"
FROM "Articles" a
inner join "Users" b on current_date - b."createdAt"::date = "articleDayReceived"
Where "isArchived" = false
Order By "articleDayReceived" DESC, "articleOrder" ASC;
