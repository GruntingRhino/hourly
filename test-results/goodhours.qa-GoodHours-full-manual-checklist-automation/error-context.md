# Page snapshot

```yaml
- generic [ref=e5]:
  - link "GoodHours" [ref=e6] [cursor=pointer]:
    - /url: /
    - img "GoodHours" [ref=e7]
  - generic [ref=e8]:
    - heading "Welcome back" [level=2] [ref=e9]
    - paragraph [ref=e10]: Sign in to your GoodHours account
    - generic [ref=e11]: Too many requests. Please wait before trying again.
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Email
        - textbox "you@school.edu" [ref=e15]: john@student.edu
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Password
          - link "Forgot password?" [ref=e19] [cursor=pointer]:
            - /url: /forgot-password
        - generic [ref=e20]:
          - textbox [ref=e21]: password123
          - button [ref=e22]:
            - img [ref=e23]
      - button "Sign In" [ref=e26]
    - generic [ref=e29]: or
    - button "Continue with Google" [ref=e31]:
      - img [ref=e32]
      - text: Continue with Google
    - generic [ref=e37]:
      - generic [ref=e38]: Dev Only
      - paragraph [ref=e39]: Bypass Google and sign in with any email domain in development.
      - generic [ref=e40]:
        - textbox "dev@any-domain.test" [ref=e41]
        - button "Dev Google" [disabled] [ref=e42]
    - paragraph [ref=e43]:
      - text: Registering a new school?
      - link "Register here" [ref=e44] [cursor=pointer]:
        - /url: /school/register
```