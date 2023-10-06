latestcommit=$(git rev-parse --short HEAD)
sed -i '' "s/build_info/$latestcommit/g" ./dist/assets/index*.js

now=$(date +'%a %b %d, %Y at %l:%M%p %Z')
sed -i '' "s/build_time/$now/g" ./dist/assets/index*.js

# credits=$(cat CREDITS.md)
# sed -i '' "s/credits_time/$credits/g" ./dist/assets/index*.js

credits=$(awk '{printf "%s\\n", $0}' CREDITS.md)
sed -i '' "s|credits_time|$credits|g" ./dist/assets/index*.js

