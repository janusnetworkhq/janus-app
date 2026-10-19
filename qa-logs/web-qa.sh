S=$(grep -o "S=[0-9]*" qa-logs/curl-results2.txt | tail -1 | cut -d= -f2); SID=$(grep -o "SID=[a-z0-9]*" qa-logs/curl-results2.txt | tail -1 | cut -d= -f2); NID=$(grep -o "NID=[a-z0-9]*" qa-logs/curl-results2.txt | tail -1 | cut -d= -f2)
tok(){ curl -s -X POST localhost:3000/v1/dev/tokens -H "content-type: application/json" -d "$1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])'; }
RT=$(tok "{\"sub\":\"qa2-rec-$S\",\"email\":\"qa2-rec-$S@janus.test\"}"); AT=$(tok "{\"sub\":\"qa2-adm-$S\",\"email\":\"qa2-adm-$S@janus.test\"}"); ST=$(tok "{\"sub\":\"qa2-stu-$S\",\"email\":\"qa2-stu-$S@janus.test\"}")
: > qa-logs/web-results.txt
w(){ r=$(curl -s -m 90 -o /tmp/wb -w "%{http_code} %{redirect_url}" ${3:+-b "janus_session=$3"} "localhost:3001$2"); e=$(grep -o -i "application error\|Unhandled Runtime Error\|NEXT_HTTP_ERROR\|digest" /tmp/wb | head -1); printf "%-10s %-38s %s %s\n" "$1" "$2" "$r" "$e" >> qa-logs/web-results.txt; }
for p in / /login /restricted /onboarding /feed /requests; do w anon $p; done
for p in /feed /requests /talent/$SID /nda/$NID /vault/$SID /admin/videos /onboarding; do w recruiter $p $RT; done
for p in /feed /admin/videos /admin/users /admin/audit; do w admin $p $AT; done
for p in /feed /admin/videos /vault/$SID; do w student $p $ST; done
echo DONE >> qa-logs/web-results.txt
