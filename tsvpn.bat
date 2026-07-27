@echo off
pushd %~dp0
deno task -q start %*
popd
