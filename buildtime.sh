# Deprecated in favor of buildtime.js for Windows compatibility

latestcommit=$(git rev-parse --short HEAD)
sed -i '' "s/build_info/$latestcommit/g" ./dist/assets/index*.js

now=$(date +'%a %b %d, %Y at %l:%M%p %Z')
sed -i '' "s/build_time/$now/g" ./dist/assets/index*.js
