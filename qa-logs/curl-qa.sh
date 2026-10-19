#!/bin/bash
B=http://localhost:3000
R=qa-logs/curl-results.txt; : > $R
c(){ # name expected method url token body
  local out code; out=$(curl -s -o /tmp/qa_body -w "%{http_code}" -X "$3" "$B$4" -H "content-type: application/json" ${5:+-H "authorization: Bearer $5"} ${6:+-d "$6"})
  code=$out; local ok=FAIL; [[ " $2 " == *" $code "* ]] && ok=PASS
  printf "%-4s %-45s exp=%-8s got=%s  %s\n" $ok "$1" "$2" "$code" "$(head -c 160 /tmp/qa_body)" | tee -a $R >/dev/null
}
tok(){ curl -s -X POST $B/v1/dev/tokens -H "content-type: application/json" -d "$1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])'; }
S=$(date +%s)
ST=$(tok "{\"sub\":\"qa-stu-$S\",\"email\":\"qa-stu-$S@janus.test\",\"name\":\"QA Student\"}")
RT=$(tok "{\"sub\":\"qa-rec-$S\",\"email\":\"qa-rec-$S@janus.test\",\"name\":\"QA Recruiter\"}")
AT=$(tok "{\"sub\":\"qa-adm-$S\",\"email\":\"qa-adm-$S@janus.test\",\"name\":\"QA Admin\"}")
c "health" 200 GET /health; c "v1/health" 200 GET /v1/health; c "ready" 200 GET /ready
c "me no token" 401 GET /v1/me; c "me bad token" 401 GET /v1/me garbage
c "feed no token" 401 GET /v1/feed
c "dev token bad body" 400 POST /v1/dev/tokens "" '{"foo":1}'
c "lookup bad email" 400 POST /v1/auth/lookup "" '{"email":"nope"}'
c "lookup seeded" 200 POST /v1/auth/lookup "" '{"email":"arjun@iitm.ac.in"}'
E="qa-otp-$S@janus.test"
c "otp send" 200 POST /v1/auth/otp/send "" "{\"email\":\"$E\",\"name\":\"OTP User\"}"
c "otp resend within cooldown" 429 POST /v1/auth/otp/send "" "{\"email\":\"$E\"}"
c "otp verify short code" 400 POST /v1/auth/otp/verify "" "{\"email\":\"$E\",\"code\":\"1\"}"
for i in 1 2 3 4; do c "otp wrong code #$i" 400 POST /v1/auth/otp/verify "" "{\"email\":\"$E\",\"code\":\"000000\"}"; done
c "otp wrong code #5 lockout" 429 POST /v1/auth/otp/verify "" "{\"email\":\"$E\",\"code\":\"000000\"}"
c "otp verify after lockout" 400 POST /v1/auth/otp/verify "" "{\"email\":\"$E\",\"code\":\"000000\"}"
c "me (new student)" 200 GET /v1/me $ST
c "profile self-assign admin" 403 POST /v1/me/profile $ST '{"role":"PLATFORM_ADMIN","handle":"x'$S'","displayName":"x"}'
c "profile bad field" 400 POST /v1/me/profile $ST '{"evil":1}'
c "profile student" "200 201" POST /v1/me/profile $ST "{\"role\":\"STUDENT\",\"handle\":\"qastu$S\",\"displayName\":\"QA Student\",\"university\":\"NITK\",\"headline\":\"Builder\",\"city\":\"Chennai\"}"
SID=$(python3 -c 'import json;print(json.load(open("/tmp/qa_body"))["id"])')
c "profile recruiter" "200 201" POST /v1/me/profile $RT "{\"role\":\"RECRUITER\",\"handle\":\"qarec$S\",\"displayName\":\"QA Recruiter\",\"orgName\":\"QA Corp\",\"orgSlug\":\"qacorp$S\",\"title\":\"TA\"}"
c "student->recruiter role switch" 403 POST /v1/me/profile $ST '{"role":"RECRUITER"}'
psql -q -d janus -h localhost -c "update users set role='PLATFORM_ADMIN', profile_complete=true, display_name='QA Admin', handle='qaadm$S' where cognito_sub='qa-adm-$S'" 2>/dev/null || psql -q "$(grep ^DATABASE_URL .env|cut -d= -f2-|sed 's/?.*//')" -c "update \"User\" set role='PLATFORM_ADMIN', \"profileComplete\"=true, \"displayName\"='QA Admin' where \"cognitoSub\"='qa-adm-$S'"
docker exec janus-redis-1 redis-cli -a janus DEL "user:sub:qa-adm-$S" >/dev/null 2>&1
c "feed" 200 GET "/v1/feed?limit=5" $RT
VID=$(python3 -c 'import json;d=json.load(open("/tmp/qa_body"));print(d["items"][0]["id"])'); AUTH=$(python3 -c 'import json;d=json.load(open("/tmp/qa_body"));print(d["items"][0]["author"]["id"])')
c "feed limit=1000" "200 400" GET "/v1/feed?limit=1000" $RT
c "feed university filter" 200 GET "/v1/feed?university=IIT" $RT
c "video get" 200 GET /v1/videos/$VID $RT
c "video get unknown" "404 400" GET /v1/videos/does-not-exist $RT
c "like" "200 201 204" POST /v1/videos/$VID/like $RT
c "like again (idempotent)" "200 201 204 409" POST /v1/videos/$VID/like $RT
c "unlike" "200 204" DELETE /v1/videos/$VID/like $RT
c "like unknown video" "404 400" POST /v1/videos/nope/like $RT
c "comment" "200 201" POST /v1/videos/$VID/comments $RT '{"body":"Great work from QA"}'
c "comment empty" 400 POST /v1/videos/$VID/comments $RT '{"body":""}'
c "comment missing body" 400 POST /v1/videos/$VID/comments $RT '{}'
c "comments list" 200 GET /v1/videos/$VID/comments $RT
c "bookmark" "200 201 204" POST /v1/videos/$VID/bookmark $RT
c "my bookmarks" 200 GET /v1/me/bookmarks $RT
c "unbookmark" "200 204" DELETE /v1/videos/$VID/bookmark $RT
c "impressions" "200 201 204" POST /v1/impressions $RT "{\"videoIds\":[\"$VID\"]}"
c "impressions bad" 400 POST /v1/impressions $RT '{"videoIds":"x"}'
c "user card" 200 GET /v1/users/$AUTH $RT
c "user videos" 200 GET /v1/users/$AUTH/videos $RT
c "user unknown" "404 400" GET /v1/users/nope $RT
c "follow" "200 201 204" POST /v1/users/$AUTH/follow $RT
c "follow self" "400 409 403" POST /v1/users/$SID/follow $ST
c "unfollow" "200 204" DELETE /v1/users/$AUTH/follow $RT
c "billing plan recruiter" 200 GET /v1/billing/plan $RT
c "billing plan student" "200 403" GET /v1/billing/plan $ST
c "org (student forbidden)" 403 GET /v1/orgs/x $ST
c "nda template" 200 GET /v1/nda/templates/default $RT
c "vault before NDA" 403 GET /v1/vault/students/$AUTH $RT
c "vault as student (wrong role)" 403 GET /v1/vault/students/$AUTH $ST
c "upload bad kind" 400 POST /v1/uploads $ST '{"kind":"BOGUS"}'
c "upload feed video ticket" "200 201" POST /v1/uploads $ST '{"kind":"FEED_VIDEO","contentType":"video/mp4","bytes":1000,"filename":"a.mp4","title":"QA video"}'
cp /tmp/qa_body /tmp/qa_upload
c "upload recruiter (wrong role?)" "403 400" POST /v1/uploads $RT '{"kind":"FEED_VIDEO","contentType":"video/mp4","bytes":1000,"filename":"a.mp4"}'
c "upload too large" 400 POST /v1/uploads $ST '{"kind":"FEED_VIDEO","contentType":"video/mp4","bytes":999999999999,"filename":"a.mp4"}'
c "nda request (recruiter->seed author)" "200 201" POST /v1/nda/requests $RT "{\"studentId\":\"$AUTH\",\"message\":\"QA\"}"
NID=$(python3 -c 'import json;print(json.load(open("/tmp/qa_body")).get("id",""))')
c "nda request bad" 400 POST /v1/nda/requests $RT '{}'
c "nda outbound" 200 GET /v1/nda/outbound $RT
c "nda inbox student" 200 GET /v1/nda/inbox $ST
c "nda decide by recruiter (wrong role)" 403 POST /v1/nda/requests/$NID/decide $RT '{"accept":true}'
c "nda decide by other student" "403 404" POST /v1/nda/requests/$NID/decide $ST '{"accept":true}'
c "nda sign before accept" "400 409 403" POST /v1/nda/requests/$NID/sign $RT '{"signerName":"QA Recruiter","agree":true}'
c "admin videos as recruiter" 403 GET /v1/admin/videos $RT
c "admin videos" 200 GET /v1/admin/videos $AT
c "admin users" 200 GET /v1/admin/users $AT
c "admin audit" 200 GET /v1/admin/audit $AT
c "admin patch bad status" 400 PATCH /v1/admin/videos/$VID $AT '{"status":"BOGUS"}'
c "delete video wrong owner" "403 404" DELETE /v1/videos/$VID $ST
echo "NID=$NID AUTH=$AUTH VID=$VID SID=$SID S=$S" >> $R
