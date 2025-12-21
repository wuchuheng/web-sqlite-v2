#!/usr/bin/env bash

# strict mode, if any command fails, the script will exit immediately.
set -euo pipefail

localDir=.vitepress/dist

log() {
  
  
  # Log level "info" in green and bold.
  levelText="\033[1;32mINFO\033[0m"
  echo -e "[$(date +"%H:%M:%S")] ${levelText} $1"
}


# if the .env file is not exist, then throw error to notice people to create it.
if [ ! -f .env ]; then
  log ".env file not found! Please create it based on .env.example"
  exit 1
fi

source .env

# Check every env variable: REMOTE_HOST, REMOTE_USER, REMOTE_PATH
# If the env variable is not set, notice people should set it in the .env file. 
envVars=("REMOTE_HOST" "REMOTE_USER" "REMOTE_PATH")
missedVars=()
for var in "${envVars[@]}"; do
  if [ -z "${!var}" ]; then
    log "Environment variable $var is not set! Please set it in the .env file."
    missedVars+=("$var")
  fi
done
remoteDir=${REMOTE_PATH}

# if the missedVars array is not empty, then exit with error.
if [ ${#missedVars[@]} -ne 0 ]; then
  log "Please set the above environment variables in the .env file."
  exit 1
fi


npm run build

if [ $? -ne 0 ]; then
  RED='\033[0;31m'
  log  "❌ ❌ ❌ ${RED} React build failure."
    if command -v notificationTool-darwin-amd64 &> /dev/null
      then
        notificationTool-darwin-amd64 "The notes failed to be build."
    fi

  exit 1
fi

log "Build successful."

tar -zcvf build.tar.gz ${localDir}
log "Created build.tar.gz"


sftp ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH} <<EOF
  mkdir -p $remoteDir
  bye
EOF

log "Ensured remote directory exists: $remoteDir"

sftp ${REMOTE_USER}@${REMOTE_HOST} <<EOF
  cd $remoteDir
  put build.tar.gz
  pwd
  ls -ahl
EOF
log "Uploaded build.tar.gz to remote server."

ssh ${REMOTE_USER}@${REMOTE_HOST} <<EOF
  cd $remoteDir
  pwd
  mv build.tar.gz ~/build.tar.gz
  rm -rf ./*
  mv ~/build.tar.gz ./
  tar -zxvf build.tar.gz
  cp -a $localDir/. .
  rm -rf $localDir
  rm -rf build.tar.gz
EOF
log "Deployed new build on remote server."

rm build.tar.gz

log "Cleaned up local build.tar.gz"

sftp ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH} <<EOF
  cd $remoteDir
  pwd
  mkdir examples
  bye
EOF
log "Ensured examples directory exists."

sftp ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH} <<EOF
  cd $remoteDir
  pwd
  put $localDir/../../../samples/cdn.html examples
  bye
EOF
log "Copied CDN example files to remote server."

log "✅ ✅ ✅ Deployment completed successfully."

