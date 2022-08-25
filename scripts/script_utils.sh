#!/bin/bash -e

pushd () {
    command pushd "$@" > /dev/null
}

popd () {
    command popd "$@" > /dev/null
}


#TODO: add support for multiple directories
mkdir () {
    if [ ! -d "$1" ]; then
        command mkdir "$1"
    fi
}
