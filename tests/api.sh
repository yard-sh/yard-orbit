#!/usr/bin/env bash
# Orbit API checks, run against a fresh local server:
#
#   yard dev --reset-db      (in another terminal, from the repository root)
#   tests/api.sh
#
# Every request picks its person with the yard_dev_identity cookie, exactly
# as a browser would after the persona picker:
#   user:free   Fran, on the Free tier, with a workspace of her own
#   user:pro    Pat, a Pro subscriber, whose workspace invites a team
#   signed-in   Sam, signed in, bought nothing; joins Pat's workspace
#   trial       Tia, on a Pro trial; joins Pat's workspace too
#
# Needs curl and jq. Reads and writes the local database through the yard
# dev control panel (loopback only).
set -uo pipefail

BASE="${BASE:-http://localhost:9875/orbit}"
API="$BASE/app/api"
PANEL="${PANEL:-http://localhost:9875/__yard/dev/api}"
FRAN="user:free"
PAT="user:pro"
SAM="signed-in"
TIA="trial"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pass=0
failed=0

# call <persona> <method> <path> [json]: sets STATUS and BODY.
call() {
  local persona=$1 method=$2 path=$3 data=${4:-'{}'}
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method" -H "Cookie: yard_dev_identity=$persona" -H 'Accept: application/json')
  if [ "$method" != GET ]; then args+=(-H 'Content-Type: application/json' --data "$data"); fi
  STATUS=$(curl "${args[@]}" "$API/$path")
  BODY=$(cat "$TMP/body")
}

# expect <label> <status> [jq filter that must hold on BODY]
expect() {
  local label=$1 want=$2 filter=${3:-}
  if [ "$STATUS" = "$want" ] && { [ -z "$filter" ] || jq -e "$filter" <<<"$BODY" >/dev/null 2>&1; }; then
    pass=$((pass + 1))
    printf '  ok    %s\n' "$label"
  else
    failed=$((failed + 1))
    printf '  FAIL  %s (got %s: %s)\n' "$label" "$STATUS" "$(head -c 300 <<<"$BODY")"
  fi
}

# sql <query>: the first column of the first row, from the local database.
sql() {
  curl -s -X POST -H 'Content-Type: application/json' "$PANEL/db/query" \
    --data "$(jq -nc --arg s "$1" '{sql: $s, params: []}')" | jq -r '.rows[0][0] // empty'
}

echo "Sign-in"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "$API/me")
[ "$STATUS" != 200 ] && pass=$((pass + 1)) && echo "  ok    anonymous is turned away ($STATUS)" ||
  { failed=$((failed + 1)); echo "  FAIL  anonymous reached the API"; }

call "$FRAN" GET me
expect "first visit makes Fran's workspace" 200 '.plan == "free" and (.workspaces | length) == 1 and .workspaces[0].role == "owner"'
FW=$(jq -r '.workspaces[0].id' <<<"$BODY")
call "$PAT" GET me
expect "Pat is on Pro" 200 '.plan == "pro" and .workspaces[0].plan == "pro"'
PW=$(jq -r '.workspaces[0].id' <<<"$BODY")
call "$SAM" GET me
expect "Sam gets a Free workspace of his own" 200 '.plan == "free"'
call "$TIA" GET me
expect "a Pro trial counts as Pro" 200 '.plan == "pro"'

echo "Sample data"
call "$FRAN" POST "workspaces/$FW/seed"
expect "seed an empty workspace" 201
call "$FRAN" POST "workspaces/$FW/seed"
expect "seed twice is refused" 409 '.code == "not_empty"'
call "$FRAN" GET "workspaces/$FW/dashboard"
expect "dashboard counts the sample" 200 '.counts == {"contacts": 16, "companies": 8, "open_deals": 8} and (.closed | length) == 8 and (.recent | length) == 10'

echo "Contacts"
call "$FRAN" GET "workspaces/$FW/contacts?q=avery"
expect "search finds one person" 200 'length == 1 and .[0].company_name == "Northwind Traders"'
call "$FRAN" GET "workspaces/$FW/contacts?q=100%25"
expect "search escapes wildcards" 200 'length == 0'
call "$FRAN" GET "workspaces/$FW/contacts?status=customer"
expect "filter by status" 200 'length == 4 and all(.status == "customer")'
call "$FRAN" POST "workspaces/$FW/contacts" '{"first_name":"Ada","last_name":"","email":"nope","phone":"","title":"","status":"lead","company_id":null,"owner_id":null}'
expect "a bad email is a 400 naming the field" 400 '.code == "invalid" and (.error | startswith("email"))'
call "$FRAN" POST "workspaces/$FW/contacts" '{"first_name":"Ada","last_name":"Lovelace","email":"","phone":"","title":"","status":"lead","company_id":null,"owner_id":null}'
expect "create a contact" 201 '.contact.first_name == "Ada" and .contact.email == null and .contact.owner_id == "dev-persona-user-free"'
ADA=$(jq -r '.contact.id' <<<"$BODY")
call "$FRAN" PATCH "workspaces/$FW/contacts/$ADA" '{"title":"Analyst","status":"active"}'
expect "patch changes only what it names" 200 '.contact.title == "Analyst" and .contact.last_name == "Lovelace"'

echo "Isolation"
call "$PAT" GET "workspaces/$FW"
expect "Pat can't open Fran's workspace" 404
call "$PAT" GET "workspaces/$PW/contacts/$ADA"
expect "Fran's contact is a 404 from Pat's workspace" 404
call "$PAT" POST "workspaces/$PW/companies" '{"name":"Acme","domain":"https://acme.example/","industry":"","size":null,"owner_id":null}'
expect "Pat creates a company, website stored as a host" 201 '.company.domain == "acme.example"'
ACME=$(jq -r '.company.id' <<<"$BODY")
call "$FRAN" PATCH "workspaces/$FW/contacts/$ADA" "{\"company_id\":\"$ACME\"}"
expect "a company from another workspace is refused" 400 '.code == "invalid_reference"'
call "$FRAN" PATCH "workspaces/$FW/contacts/$ADA" '{"owner_id":"dev-persona-user-pro"}'
expect "an owner from outside the workspace is refused" 400 '.code == "invalid_reference"'

echo "Free limits"
call "$FRAN" GET "workspaces/$FW"
TOKEN_F=$(jq -r '.invite_token' <<<"$BODY")
expect "the owner sees the invite link" 200 '.invite_token != null and .limits.members == 1 and .usage.contacts == 17'
call "$SAM" GET "invites/$TOKEN_F"
expect "a Free workspace is full at one person" 200 '.full == true and .already_member == false'
call "$SAM" POST "invites/$TOKEN_F/accept"
expect "joining it is a 402" 402 '.code == "plan_limit" and .limit == "members"'
sql "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 233)
  INSERT INTO contacts (id, workspace_id, first_name, status, created_at, updated_at)
  SELECT 'bulk-' || i, '$FW', 'Bulk', 'lead', 0, 0 FROM n" >/dev/null
call "$FRAN" POST "workspaces/$FW/contacts" '{"first_name":"One","last_name":"More","email":"","phone":"","title":"","status":"lead","company_id":null,"owner_id":null}'
expect "contact 251 is a 402" 402 '.code == "plan_limit" and .limit == "contacts"'
sql "DELETE FROM contacts WHERE id LIKE 'bulk-%'" >/dev/null

echo "Teams"
call "$PAT" GET "workspaces/$PW"
TOKEN_P=$(jq -r '.invite_token' <<<"$BODY")
call "$SAM" GET "invites/$TOKEN_P"
expect "Sam previews Pat's invite" 200 '.full == false and .workspace.id == "'"$PW"'"'
call "$SAM" POST "invites/$TOKEN_P/accept"
expect "Sam joins" 200 '.workspace_id == "'"$PW"'"'
call "$SAM" POST "invites/$TOKEN_P/accept"
expect "joining twice is harmless" 200
call "$TIA" POST "invites/$TOKEN_P/accept"
expect "Tia joins" 200
call "$SAM" GET me
expect "Sam sees both workspaces, his own first" 200 '(.workspaces | length) == 2 and .workspaces[0].is_owner and .workspaces[1].role == "member" and .workspaces[1].plan == "pro"'
call "$SAM" GET "workspaces/$PW"
expect "members don't see the invite link" 200 '.invite_token == null and .usage.members == 3'
call "$SAM" POST "workspaces/$PW/invite/reset"
expect "members can't reset the link" 403
call "$SAM" DELETE "workspaces/$PW/members/dev-persona-trial"
expect "members can't remove people" 403
call "$SAM" PATCH "workspaces/$PW/members/dev-persona-trial" '{"role":"admin"}'
expect "members can't promote" 403
call "$PAT" PATCH "workspaces/$PW/members/dev-persona-signed-in" '{"role":"admin"}'
expect "the owner promotes Sam" 204
call "$SAM" DELETE "workspaces/$PW/members/dev-persona-user-pro"
expect "nobody removes the owner" 400
call "$SAM" POST "workspaces/$PW/contacts" '{"first_name":"Joint","last_name":"Lead","email":"","phone":"","title":"","status":"lead","company_id":null,"owner_id":"dev-persona-trial"}'
expect "a member's contact can be owned by a teammate" 201 '.contact.owner_name != null'

echo "Deals and timeline"
call "$PAT" POST "workspaces/$PW/deals" "{\"title\":\"Acme rollout\",\"value\":5000,\"stage\":\"lead\",\"company_id\":\"$ACME\",\"contact_id\":null,\"owner_id\":null,\"expected_close_at\":null}"
expect "create a deal" 201 '.deal.stage == "lead" and .deal.closed_at == null and .deal.company_name == "Acme"'
DEAL=$(jq -r '.deal.id' <<<"$BODY")
call "$TIA" POST "workspaces/$PW/deals/$DEAL/move" '{"stage":"won","position":1.5}'
expect "a teammate drags it to Won" 200 '.stage == "won" and .closed_at != null and .position == 1.5'
call "$PAT" GET "workspaces/$PW/activities?deal_id=$DEAL"
expect "the timeline records creation and the move" 200 '(map(.kind) | sort) == ["created", "stage_change"] and (map(select(.kind == "stage_change"))[0].body == "lead:won")'
call "$PAT" GET "workspaces/$PW/activities?company_id=$ACME"
expect "deal history shows on the company too" 200 'length == 2'
call "$TIA" POST "workspaces/$PW/activities" "{\"kind\":\"call\",\"body\":\"Signed today\",\"deal_id\":\"$DEAL\"}"
expect "log a call on the deal" 201 '.company_name == "Acme" and .author_name != null'
NOTE=$(jq -r '.id' <<<"$BODY")
call "$PAT" PATCH "workspaces/$PW/members/dev-persona-signed-in" '{"role":"member"}'
call "$SAM" DELETE "workspaces/$PW/activities/$NOTE"
expect "members can't delete a teammate's entry" 403
call "$TIA" DELETE "workspaces/$PW/activities/$NOTE"
expect "authors delete their own" 204

echo "Tasks"
call "$PAT" POST "workspaces/$PW/tasks" "{\"title\":\"Send contract\",\"due_at\":1,\"assignee_id\":\"dev-persona-trial\",\"contact_id\":null,\"company_id\":null,\"deal_id\":\"$DEAL\"}"
expect "create a task for Tia" 201 '.deal_title == "Acme rollout" and .done_at == null'
TASK=$(jq -r '.id' <<<"$BODY")
call "$TIA" GET "workspaces/$PW/dashboard"
expect "it's on Tia's dashboard" 200 '.my_tasks | map(.id) | index("'"$TASK"'") != null'
call "$TIA" PATCH "workspaces/$PW/tasks/$TASK" '{"done":true}'
expect "complete it" 200 '.done_at != null'
DONE_AT=$(jq -r '.done_at' <<<"$BODY")
call "$TIA" PATCH "workspaces/$PW/tasks/$TASK" '{"done":true}'
expect "completing it again keeps when it was done" 200 ".done_at == $DONE_AT"
call "$TIA" GET "workspaces/$PW/tasks"
expect "open tasks leave it out" 200 'map(.id) | index("'"$TASK"'") == null'
call "$TIA" GET "workspaces/$PW/tasks?status=done"
expect "done tasks list it" 200 'map(.id) | index("'"$TASK"'") != null'

echo "Deletes"
call "$PAT" DELETE "workspaces/$PW/companies/$ACME"
expect "delete the company" 204
call "$PAT" GET "workspaces/$PW/deals/$DEAL"
expect "its deal stays, unlinked" 200 '.deal.company_id == null'
call "$PAT" DELETE "workspaces/$PW/deals/$DEAL"
expect "delete the deal" 204
[ "$(sql "SELECT COUNT(*) FROM activities WHERE deal_id = '$DEAL' OR company_id = '$ACME'")" = 0 ] &&
  { pass=$((pass + 1)); echo "  ok    their timelines are gone"; } ||
  { failed=$((failed + 1)); echo "  FAIL  activities left behind"; }
call "$PAT" GET "workspaces/$PW/tasks?status=done"
expect "the task stays, unlinked" 200 'map(select(.id == "'"$TASK"'"))[0].deal_id == null'
call "$TIA" DELETE "workspaces/$PW/members/dev-persona-trial"
expect "Tia leaves" 204
call "$TIA" GET "workspaces/$PW"
expect "and can't open it any more" 404

echo
echo "$pass passed, $failed failed"
[ "$failed" = 0 ]
