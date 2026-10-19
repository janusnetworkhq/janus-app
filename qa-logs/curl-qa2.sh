#!/bin/bash
B=http://localhost:3000; R=qa-logs/curl-results2.txt; : > $R
DB=$(grep ^DATABASE_URL .env|cut -d= -f2-|tr -d '"'|sed 's/?.*//')
c(){ local code; if [ -n "$6" ]; then code=$(curl -s -o /tmp/qa_body -w "%{http_code}" -X "$3" "$B$4" -H "content-type: application/json" ${5:+-H "authorization: Bearer $5"} ${7:+-H "idempotency-key: $7"} -d "$6"); else code=$(curl -s -o /tmp/qa_body -w "%{http_code}" -X "$3" "$B$4" ${5:+-H "authorization: Bearer $5"} ${7:+-H "idempotency-key: $7"}); fi
  local ok=FAIL; [[ " $2 " == *" $code "* ]] && ok=PASS
  printf "%-4s %-42s exp=%-12s got=%s  %s\n" $ok "$1" "$2" "$code" "$(head -c 150 /tmp/qa_body)" >> $R; }
j(){ python3 -c "import json;d=json.load(open('/tmp/qa_body'));print($1)"; }
tok(){ curl -s -X POST $B/v1/dev/tokens -H "content-type: application/json" -d "$1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])'; }
S=$(date +%s)
ST=$(tok "{\"sub\":\"qa2-stu-$S\",\"email\":\"qa2-stu-$S@janus.test\",\"name\":\"QA2 Student\"}")
ST2=$(tok "{\"sub\":\"qa2-stub-$S\",\"email\":\"qa2-stub-$S@janus.test\",\"name\":\"QA2 Other\"}")
RT=$(tok "{\"sub\":\"qa2-rec-$S\",\"email\":\"qa2-rec-$S@janus.test\",\"name\":\"QA2 Recruiter\"}")
AT=$(tok "{\"sub\":\"qa2-adm-$S\",\"email\":\"qa2-adm-$S@janus.test\",\"name\":\"QA2 Admin\"}")
c "onboard student" "201" POST /v1/me/profile $ST "{\"role\":\"STUDENT\",\"handle\":\"qa2stu$S\",\"displayName\":\"QA2 Student\",\"university\":\"NITK\"}"; SID=$(j 'd["id"]')
c "onboard student2" "201" POST /v1/me/profile $ST2 "{\"role\":\"STUDENT\",\"handle\":\"qa2stub$S\",\"displayName\":\"QA2 Other\",\"university\":\"IITM\"}"
c "onboard recruiter" "201" POST /v1/me/profile $RT "{\"role\":\"RECRUITER\",\"handle\":\"qa2rec$S\",\"displayName\":\"QA2 Recruiter\",\"orgName\":\"QA2\",\"orgSlug\":\"qa2$S\",\"title\":\"TA\"}"
c "admin me (creates row)" 200 GET /v1/me $AT
psql "$DB" -qc "update users set role='PLATFORM_ADMIN', profile_complete=true, display_name='QA2 Admin', handle='qa2adm$S' where cognito_sub='qa2-adm-$S'" >> $R 2>&1
docker exec janus-redis-1 redis-cli -a janus DEL "user:sub:qa2-adm-$S" >/dev/null 2>&1
c "upload ticket feed video" "200 201" POST /v1/uploads $ST '{"kind":"FEED_VIDEO","contentType":"video/mp4","byteSize":1024,"durationMs":15000,"caption":"QA2 prototype"}'; UP=$(j 'd["uploadId"]'); UURL=$(j 'd["uploadUrl"]')
c "upload complete before PUT (missing obj)" "400" POST /v1/uploads/$UP/complete $ST '{}'
curl -s -o /dev/null -w "   PUT video -> %{http_code}\n" -X PUT -H "content-type: video/mp4" --data-binary @/tmp/qa.mp4 "$UURL" >> $R
c "upload too long duration" 400 POST /v1/uploads $ST '{"kind":"FEED_VIDEO","contentType":"video/mp4","byteSize":1024,"durationMs":999999}'
c "upload as recruiter" "403" POST /v1/uploads $RT '{"kind":"FEED_VIDEO","contentType":"video/mp4","byteSize":1024,"durationMs":1000}'
c "upload complete by other student" "403 404" POST /v1/uploads/$UP/complete $ST2 '{}'
c "upload complete" "200 201" POST /v1/uploads/$UP/complete $ST '{}'; VID=$(j 'd.get("videoId")')
c "upload complete twice" "200 201 409 400" POST /v1/uploads/$UP/complete $ST '{}'
sleep 4; c "video READY" 200 GET /v1/videos/$VID $RT; echo "   status=$(j 'd.get("status")')" >> $R
c "vault file ticket" "200 201" POST /v1/uploads $ST '{"kind":"VAULT_FILE","contentType":"application/pdf","byteSize":2048,"originalName":"s.pdf","vaultKind":"SCHEMATIC"}'; VU=$(j 'd["uploadId"]'); VURL=$(j 'd["uploadUrl"]')
curl -s -o /dev/null -w "   PUT pdf -> %{http_code}\n" -X PUT -H "content-type: application/pdf" --data-binary @/tmp/qa.pdf "$VURL" >> $R
c "vault file complete" "200 201" POST /v1/uploads/$VU/complete $ST "{\"vaultKind\":\"SCHEMATIC\",\"originalName\":\"s.pdf\",\"videoId\":\"$VID\"}"
c "like" "200 201" POST /v1/videos/$VID/like $RT; c "like again" "200 201" POST /v1/videos/$VID/like $RT
c "like unknown" "404" POST /v1/videos/nope/like $RT
c "bookmark" "200 201" POST /v1/videos/$VID/bookmark $RT; c "bookmarks list" 200 GET /v1/me/bookmarks $RT
c "follow" "200 201" POST /v1/users/$SID/follow $RT; c "follow self" "400 409" POST /v1/users/$SID/follow $ST
c "follow unknown" "404" POST /v1/users/nope/follow $RT
c "vault before NDA" 403 GET /v1/vault/students/$SID $RT
c "template" 200 GET /v1/nda/templates/default $RT; H=$(j 'd["contentSha256"]')
c "nda request" "200 201" POST /v1/nda/requests $RT "{\"studentId\":\"$SID\",\"videoId\":\"$VID\",\"reason\":\"hiring\"}" nda-$S; NID=$(j 'd["id"]')
c "nda request idempotent replay" "200 201" POST /v1/nda/requests $RT "{\"studentId\":\"$SID\",\"videoId\":\"$VID\",\"reason\":\"hiring\"}" nda-$S; echo "   same id: $([ "$(j 'd["id"]')" = "$NID" ] && echo yes || echo no)" >> $R
c "nda request to self" "400 403 409" POST /v1/nda/requests $ST "{\"studentId\":\"$SID\"}"
c "nda request unknown student" "404 400" POST /v1/nda/requests $RT '{"studentId":"nope"}'
c "inbox student" 200 GET /v1/nda/inbox $ST; echo "   count=$(j 'len(d) if isinstance(d,list) else d')" >> $R
c "outbound recruiter" 200 GET /v1/nda/outbound $RT
c "sign before accept" "400 409" POST /v1/nda/requests/$NID/sign $RT "{\"typedName\":\"QA2 Recruiter\",\"acceptedHash\":\"$H\"}" s0-$S
c "decide by other student" "403 404" POST /v1/nda/requests/$NID/decide $ST2 '{"accept":true}'
c "decide bad body (\"false\" string)" 400 POST /v1/nda/requests/$NID/decide $ST '{"accept":"false"}'
c "decide accept" "200 201" POST /v1/nda/requests/$NID/decide $ST '{"accept":true}'
c "sign wrong hash" "400 409" POST /v1/nda/requests/$NID/sign $RT '{"typedName":"QA2 Recruiter","acceptedHash":"deadbeef"}' s1-$S
c "sign by student" "403 400" POST /v1/nda/requests/$NID/sign $ST2 "{\"typedName\":\"x\",\"acceptedHash\":\"$H\"}" s2-$S
c "sign" "200 201" POST /v1/nda/requests/$NID/sign $RT "{\"typedName\":\"QA2 Recruiter\",\"acceptedHash\":\"$H\"}" s3-$S; GID=$(j 'd.get("grant",{}).get("id") or d.get("grantId") or ""'); echo "   keys=$(j 'list(d.keys())')" >> $R
c "vault list" 200 GET /v1/vault/students/$SID $RT; AID=$(j 'd["items"][0]["id"]')
c "vault playback" "200 201" POST /v1/vault/assets/$AID/playback $RT
c "vault playback unknown asset" "403 404" POST /v1/vault/assets/nope/playback $RT
[ -z "$GID" ] && GID=$(psql "$DB" -tAc "select id from access_grants order by created_at desc limit 1" 2>/dev/null)
c "revoke by other student" "403 404" POST /v1/nda/grants/$GID/revoke $ST2
c "revoke grant" "200 201" POST /v1/nda/grants/$GID/revoke $ST
c "vault after revoke" 403 GET /v1/vault/students/$SID $RT
c "admin videos" 200 GET /v1/admin/videos $AT; c "admin users" 200 GET /v1/admin/users $AT; c "admin audit" 200 GET /v1/admin/audit $AT
c "admin videos as student" 403 GET /v1/admin/videos $ST
c "admin patch bad status" 400 PATCH /v1/admin/videos/$VID $AT '{"status":"BOGUS"}'
c "admin hide video" 200 PATCH /v1/admin/videos/$VID $AT '{"status":"HIDDEN"}'
c "hidden video in feed?" 200 GET "/v1/feed?limit=20" $RT; echo "   hidden present: $(j "any(i['id']=='$VID' for i in d['items'])")" >> $R
c "delete video by other student" "403 404" DELETE /v1/videos/$VID $ST2
c "delete own video" "200 204" DELETE /v1/videos/$VID $ST
echo "SID=$SID NID=$NID GID=$GID S=$S" >> $R
echo "TOKENS ST=$ST RT=$RT AT=$AT" > /tmp/qa_tokens
