import os
import re

def check_jsx_tags(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.jsx'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        open_tags = len(re.findall(r'<div', content))
                        close_tags = len(re.findall(r'</div>', content))
                        if open_tags != close_tags:
                            print(f"{os.path.abspath(path)}: {open_tags} vs {close_tags}")
                except:
                    pass

if __name__ == "__main__":
    check_jsx_tags('.')
