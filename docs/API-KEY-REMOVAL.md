# Emergency API Key Removal Steps

## IMMEDIATE ACTION REQUIRED

1. **REVOKE THE EXPOSED API KEYS IMMEDIATELY**
   - Go to the Google API Console and invalidate/rotate the exposed Google Maps API key
   - Create a new key to replace the compromised one

## Removing Sensitive Data from Git History

Follow these steps to completely remove the sensitive API keys from your Git history:

### 1. Install git-filter-repo

```bash
pip install git-filter-repo
```

### 2. Make a fresh clone of your repository

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git clean-repo
cd clean-repo
```

### 3. Remove the sensitive data

Use git-filter-repo to remove the sensitive files from history:

```bash
git filter-repo --sensitive-data-removal --replace-text <(echo 'AIzaSyAKTHki3haMOQ5fhzKA5wbNVnuR_tv_zaY==>REDACTED')
```

This will replace all instances of your API key with "REDACTED" in all files in your repository history.

### 4. Verify the removal

Check that the API key doesn't appear anywhere in the history:

```bash
git log -p | grep -i AIzaSyAKTHki3haMOQ5fhzKA5wbNVnuR_tv_zaY
```

### 5. Push the cleaned repository

Force push your changes to overwrite the GitHub repository:

```bash
git push origin --force --all
git push origin --force --tags
```

### 6. Contact GitHub Support

1. Contact GitHub Support through their support portal
2. Provide the following information:
   - Your repository name
   - The number of affected pull requests
   - The first changed commit(s) reported by git-filter-repo
   - Request them to run garbage collection to completely purge the sensitive data

### 7. Notify team members

1. Tell all collaborators to rebase (NOT merge) their branches
2. Ask them to clone a fresh copy of the repository or follow proper cleanup instructions

## Preventing Future Exposure

1. Use the environment configuration setup from ENV-SETUP.md
2. Add pre-commit hooks to detect sensitive data
3. Consider using GitHub's secret scanning features
4. Rotate API keys periodically
5. Educate team members about proper handling of sensitive data

## References

- [Removing sensitive data from a repository (GitHub Docs)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [git-filter-repo](https://github.com/newren/git-filter-repo) 