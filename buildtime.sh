latestcommit=$(git rev-parse --short HEAD)
now=$(date +'%a %b %d, %Y at %l:%M%P %Z')

sed -i '' "s/build_info/$latestcommit/g" ./dist/assets/index*.js
sed -i '' "s/build_time/$now/g" ./dist/assets/index*.js
