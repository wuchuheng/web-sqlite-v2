# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
# Functions
eval "$(echo 'Z2F3a2xpYnBhdGhfYXBwZW5kICgpIAp7IAogICAgWyAteiAiJEFXS0xJQlBBVEgiIF0gJiYgQVdL
TElCUEFUSD1gZ2F3ayAnQkVHSU4ge3ByaW50IEVOVklST05bIkFXS0xJQlBBVEgiXX0nYDsKICAg
IGV4cG9ydCBBV0tMSUJQQVRIPSIkQVdLTElCUEFUSDokKiIKfQo=' | base64 -d)" > /dev/null 2>&1
eval "$(echo 'Z2F3a2xpYnBhdGhfZGVmYXVsdCAoKSAKeyAKICAgIHVuc2V0IEFXS0xJQlBBVEg7CiAgICBleHBv
cnQgQVdLTElCUEFUSD1gZ2F3ayAnQkVHSU4ge3ByaW50IEVOVklST05bIkFXS0xJQlBBVEgiXX0n
YAp9Cg==' | base64 -d)" > /dev/null 2>&1
eval "$(echo 'Z2F3a2xpYnBhdGhfcHJlcGVuZCAoKSAKeyAKICAgIFsgLXogIiRBV0tMSUJQQVRIIiBdICYmIEFX
S0xJQlBBVEg9YGdhd2sgJ0JFR0lOIHtwcmludCBFTlZJUk9OWyJBV0tMSUJQQVRIIl19J2A7CiAg
ICBleHBvcnQgQVdLTElCUEFUSD0iJCo6JEFXS0xJQlBBVEgiCn0K' | base64 -d)" > /dev/null 2>&1
eval "$(echo 'Z2F3a3BhdGhfYXBwZW5kICgpIAp7IAogICAgWyAteiAiJEFXS1BBVEgiIF0gJiYgQVdLUEFUSD1g
Z2F3ayAnQkVHSU4ge3ByaW50IEVOVklST05bIkFXS1BBVEgiXX0nYDsKICAgIGV4cG9ydCBBV0tQ
QVRIPSIkQVdLUEFUSDokKiIKfQo=' | base64 -d)" > /dev/null 2>&1
eval "$(echo 'Z2F3a3BhdGhfZGVmYXVsdCAoKSAKeyAKICAgIHVuc2V0IEFXS1BBVEg7CiAgICBleHBvcnQgQVdL
UEFUSD1gZ2F3ayAnQkVHSU4ge3ByaW50IEVOVklST05bIkFXS1BBVEgiXX0nYAp9Cg==' | base64 -d)" > /dev/null 2>&1
eval "$(echo 'Z2F3a3BhdGhfcHJlcGVuZCAoKSAKeyAKICAgIFsgLXogIiRBV0tQQVRIIiBdICYmIEFXS1BBVEg9
YGdhd2sgJ0JFR0lOIHtwcmludCBFTlZJUk9OWyJBV0tQQVRIIl19J2A7CiAgICBleHBvcnQgQVdL
UEFUSD0iJCo6JEFXS1BBVEgiCn0K' | base64 -d)" > /dev/null 2>&1
# Shell Options
shopt -u autocd
shopt -u assoc_expand_once
shopt -u cdable_vars
shopt -u cdspell
shopt -u checkhash
shopt -u checkjobs
shopt -s checkwinsize
shopt -s cmdhist
shopt -u compat31
shopt -u compat32
shopt -u compat40
shopt -u compat41
shopt -u compat42
shopt -u compat43
shopt -u compat44
shopt -s complete_fullquote
shopt -u direxpand
shopt -u dirspell
shopt -u dotglob
shopt -u execfail
shopt -u expand_aliases
shopt -u extdebug
shopt -u extglob
shopt -s extquote
shopt -u failglob
shopt -s force_fignore
shopt -s globasciiranges
shopt -s globskipdots
shopt -u globstar
shopt -u gnu_errfmt
shopt -u histappend
shopt -u histreedit
shopt -u histverify
shopt -s hostcomplete
shopt -u huponexit
shopt -u inherit_errexit
shopt -s interactive_comments
shopt -u lastpipe
shopt -u lithist
shopt -u localvar_inherit
shopt -u localvar_unset
shopt -s login_shell
shopt -u mailwarn
shopt -u no_empty_cmd_completion
shopt -u nocaseglob
shopt -u nocasematch
shopt -u noexpand_translation
shopt -u nullglob
shopt -s patsub_replacement
shopt -s progcomp
shopt -u progcomp_alias
shopt -s promptvars
shopt -u restricted_shell
shopt -u shift_verbose
shopt -s sourcepath
shopt -u varredir_close
shopt -u xpg_echo
set -o braceexpand
set -o hashall
set -o interactive-comments
set -o monitor
set -o onecmd
shopt -s expand_aliases
# Aliases
# Check for rg availability
if ! command -v rg >/dev/null 2>&1; then
  alias rg='/home/wuchuheng/.dotfiles/src/XDG_CACHE_HOME/pnpm/global/5/.pnpm/\@anthropic-ai+claude-code\@2.0.76/node_modules/\@anthropic-ai/claude-code/vendor/ripgrep/x64-linux/rg'
fi
export PATH='/home/wuchuheng/.dotfiles/src/XDG_CACHE_HOME/pnpm:/home/wuchuheng/.dotfiles/src/bin:/home/wuchuheng/.zpm/bin:/home/wuchuheng/.trae-server/bin/stable-62b10a85ccc1ada21a1f0c7d9e37845523f43e26-debian10/bin/remote-cli:/home/wuchuheng/.local/bin:/home/wuchuheng/miniforge3/bin:/home/wuchuheng/miniforge3/condabin:/home/wuchuheng/.local/bin:/home/wuchuheng/.local/bin:/home/wuchuheng/.dotfiles/src/XDG_CONFIG_HOME/nvm/versions/node/v22.20.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/usr/lib/wsl/lib:/mnt/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.4/bin:/mnt/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.4/libnvvp:/mnt/c/Windows/system32:/mnt/c/Windows:/mnt/c/Windows/System32/Wbem:/mnt/c/Windows/System32/WindowsPowerShell/v1.0:/mnt/c/Windows/System32/OpenSSH:/mnt/c/Users/Administrator/AppData/Local/nvm:/mnt/c/nvm4w/nodejs:/mnt/c/Program Files/Git/cmd:/mnt/d/Program Files/PuTTY:/mnt/c/Program Files/Vagrant/bin:/mnt/c/Program Files/NVIDIA Corporation/Nsight Compute 2024.1.0:/mnt/c/Program Files (x86)/NVIDIA Corporation/PhysX/Common:/mnt/c/Program Files/NVIDIA Corporation/NVIDIA NvDLISR:/Docker/host/bin:/mnt/c/Users/Administrator/.local/bin:/mnt/c/Users/Administrator/AppData/Local/Programs/Python/Python312/Scripts:/mnt/c/Users/Administrator/AppData/Local/Programs/Python/Python312:/mnt/c/Users/Administrator/AppData/Local/Programs/Trae/bin:/mnt/c/Users/Administrator/AppData/Local/Programs/Python/Python311/Scripts:/mnt/c/Users/Administrator/AppData/Local/Programs/Python/Python311:/mnt/c/Python/Python314/Scripts:/mnt/c/Python/Python314:/mnt/c/Users/Administrator/AppData/Local/Microsoft/WindowsApps:/mnt/c/Users/Administrator/AppData/Local/Programs/Ollama:/mnt/c/Users/Administrator/AppData/Local/Programs/Microsoft VS Code/bin:/mnt/c/Users/Administrator/AppData/Local/nvm:/mnt/c/nvm4w/nodejs:/mnt/c/Python/Python314:/mnt/c/Users/Administrator/AppData/Local/Programs/Qoder/bin:/mnt/c/Users/Administrator/AppData/Local/Programs/Comate/bin:/mnt/c/Program Files/JetBrains/WebStorm 2025.3/bin:/mnt/c/Users/Administrator/AppData/Local/Programs/Antigravity/bin:/mnt/c/Users/Administrator/AppData/Local/Microsoft/WinGet/Packages/ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe:/mnt/c/Users/Administrator/AppData/Local/Programs/Trae/resources/app/bin/lib:/snap/bin'
