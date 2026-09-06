#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wchar.h>

static const wchar_t *command_line_tail(void) {
  const wchar_t *cursor = GetCommandLineW();
  if (!cursor) return L"";
  if (*cursor == L'\"') {
    cursor++;
    while (*cursor && *cursor != L'\"') cursor++;
    if (*cursor == L'\"') cursor++;
  } else {
    while (*cursor && *cursor != L' ' && *cursor != L'\t') cursor++;
  }
  while (*cursor == L' ' || *cursor == L'\t') cursor++;
  return cursor;
}

static void show_launch_error(DWORD error_code) {
  wchar_t message[512];
  wchar_t system_message[320] = L"Unknown Windows error.";
  FormatMessageW(
    FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
    NULL,
    error_code,
    0,
    system_message,
    (DWORD)(sizeof(system_message) / sizeof(system_message[0])),
    NULL
  );
  _snwprintf_s(
    message,
    sizeof(message) / sizeof(message[0]),
    _TRUNCATE,
    L"Pre-Programmed could not start its bundled runtime.\n\n%s\n\nWindows error: %lu",
    system_message,
    error_code
  );
  MessageBoxW(NULL, message, L"Pre-Programmed could not start", MB_OK | MB_ICONERROR);
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR command_line, int show_command) {
  (void)instance;
  (void)previous;
  (void)command_line;
  (void)show_command;

  wchar_t launcher_path[32768];
  DWORD length = GetModuleFileNameW(NULL, launcher_path, (DWORD)(sizeof(launcher_path) / sizeof(launcher_path[0])));
  if (!length || length >= (DWORD)(sizeof(launcher_path) / sizeof(launcher_path[0]))) {
    show_launch_error(GetLastError());
    return 1;
  }

  wchar_t *separator = wcsrchr(launcher_path, L'\\');
  if (!separator) {
    show_launch_error(ERROR_PATH_NOT_FOUND);
    return 1;
  }
  *separator = L'\0';

  wchar_t runtime_path[32768];
  if (_snwprintf_s(
        runtime_path,
        sizeof(runtime_path) / sizeof(runtime_path[0]),
        _TRUNCATE,
        L"%s\\_engine\\Pre-Programmed.exe",
        launcher_path
      ) < 0) {
    show_launch_error(ERROR_BUFFER_OVERFLOW);
    return 1;
  }

  const wchar_t *tail = command_line_tail();
  size_t command_length = wcslen(runtime_path) + wcslen(tail) + 6;
  wchar_t *child_command = (wchar_t *)HeapAlloc(GetProcessHeap(), HEAP_ZERO_MEMORY, command_length * sizeof(wchar_t));
  if (!child_command) {
    show_launch_error(ERROR_NOT_ENOUGH_MEMORY);
    return 1;
  }
  if (*tail) {
    _snwprintf_s(child_command, command_length, _TRUNCATE, L"\"%s\" %s", runtime_path, tail);
  } else {
    _snwprintf_s(child_command, command_length, _TRUNCATE, L"\"%s\"", runtime_path);
  }

  STARTUPINFOW startup;
  PROCESS_INFORMATION process;
  ZeroMemory(&startup, sizeof(startup));
  ZeroMemory(&process, sizeof(process));
  startup.cb = sizeof(startup);

  BOOL created = CreateProcessW(
    runtime_path,
    child_command,
    NULL,
    NULL,
    TRUE,
    0,
    NULL,
    launcher_path,
    &startup,
    &process
  );
  HeapFree(GetProcessHeap(), 0, child_command);

  if (!created) {
    show_launch_error(GetLastError());
    return 1;
  }

  CloseHandle(process.hThread);
  WaitForSingleObject(process.hProcess, INFINITE);

  DWORD exit_code = 1;
  if (!GetExitCodeProcess(process.hProcess, &exit_code)) exit_code = 1;
  CloseHandle(process.hProcess);
  return (int)exit_code;
}
