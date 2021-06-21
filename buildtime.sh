latestcommit=$(git rev-parse --short HEAD)
now=$(date +'%a %b %d, %Y at %r %Z')

sed -i '' "s/build_info/$latestcommit/g" ./build/index.html
sed -i '' "s/build_time/$now/g" ./build/index.html
