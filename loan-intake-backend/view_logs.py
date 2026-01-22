"""
Log Viewer - Quick script to view and tail log files
"""

import os
import sys
from datetime import datetime

LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')

def list_logs():
    """List all available log files"""
    if not os.path.exists(LOGS_DIR):
        print("No logs directory found yet. Start the backend to create logs.")
        return
    
    print("\n" + "="*70)
    print("AVAILABLE LOG FILES")
    print("="*70)
    
    log_files = [f for f in os.listdir(LOGS_DIR) if f.endswith('.log')]
    
    if not log_files:
        print("No log files found yet. Start the backend to create logs.")
        return
    
    for i, log_file in enumerate(sorted(log_files), 1):
        path = os.path.join(LOGS_DIR, log_file)
        size = os.path.getsize(path)
        modified = datetime.fromtimestamp(os.path.getmtime(path))
        
        print(f"\n{i}. {log_file}")
        print(f"   Size: {size:,} bytes")
        print(f"   Modified: {modified.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Path: {path}")
    
    print("\n" + "="*70)


def view_log(filename, lines=50):
    """View last N lines of a log file"""
    path = os.path.join(LOGS_DIR, filename)
    
    if not os.path.exists(path):
        print(f"Log file not found: {path}")
        return
    
    print("\n" + "="*70)
    print(f"LAST {lines} LINES OF: {filename}")
    print("="*70 + "\n")
    
    with open(path, 'r', encoding='utf-8') as f:
        all_lines = f.readlines()
        last_lines = all_lines[-lines:]
        
        for line in last_lines:
            print(line.rstrip())
    
    print("\n" + "="*70)
    print(f"Total lines in file: {len(all_lines)}")
    print("="*70)


def search_logs(keyword, filename=None):
    """Search for keyword in log files"""
    print("\n" + "="*70)
    print(f"SEARCHING FOR: '{keyword}'")
    print("="*70 + "\n")
    
    if filename:
        files_to_search = [filename]
    else:
        files_to_search = [f for f in os.listdir(LOGS_DIR) if f.endswith('.log')]
    
    total_matches = 0
    
    for log_file in files_to_search:
        path = os.path.join(LOGS_DIR, log_file)
        
        if not os.path.exists(path):
            continue
        
        with open(path, 'r', encoding='utf-8') as f:
            matches = []
            for line_num, line in enumerate(f, 1):
                if keyword.lower() in line.lower():
                    matches.append((line_num, line.rstrip()))
        
        if matches:
            print(f"\n📄 {log_file} ({len(matches)} matches):")
            print("-" * 70)
            for line_num, line in matches:
                print(f"Line {line_num}: {line}")
            total_matches += len(matches)
    
    print("\n" + "="*70)
    print(f"Total matches found: {total_matches}")
    print("="*70)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments - list logs
        list_logs()
    
    elif sys.argv[1] == "list":
        list_logs()
    
    elif sys.argv[1] == "view":
        if len(sys.argv) < 3:
            print("Usage: python view_logs.py view <filename> [lines]")
            list_logs()
        else:
            filename = sys.argv[2]
            lines = int(sys.argv[3]) if len(sys.argv) > 3 else 50
            view_log(filename, lines)
    
    elif sys.argv[1] == "search":
        if len(sys.argv) < 3:
            print("Usage: python view_logs.py search <keyword> [filename]")
        else:
            keyword = sys.argv[2]
            filename = sys.argv[3] if len(sys.argv) > 3 else None
            search_logs(keyword, filename)
    
    elif sys.argv[1] == "errors":
        # Quick shortcut to view errors
        view_log("errors.log", 100)
    
    elif sys.argv[1] == "auth":
        # Quick shortcut to view auth logs
        view_log("auth.log", 50)
    
    elif sys.argv[1] == "api":
        # Quick shortcut to view API logs
        view_log("api_requests.log", 50)
    
    else:
        print("\nUsage:")
        print("  python view_logs.py                    # List all logs")
        print("  python view_logs.py list               # List all logs")
        print("  python view_logs.py view <file> [N]    # View last N lines (default 50)")
        print("  python view_logs.py search <keyword>   # Search all logs")
        print("  python view_logs.py errors             # Quick view errors.log")
        print("  python view_logs.py auth               # Quick view auth.log")
        print("  python view_logs.py api                # Quick view api_requests.log")
        print("\nExamples:")
        print("  python view_logs.py view app.log 100")
        print("  python view_logs.py search 'Could not validate'")
        print("  python view_logs.py search 'token' auth.log")
