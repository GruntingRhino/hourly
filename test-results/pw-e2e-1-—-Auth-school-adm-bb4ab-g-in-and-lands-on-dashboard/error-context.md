# Page snapshot

```yaml
- generic [ref=e4]:
  - link "GoodHours" [ref=e5] [cursor=pointer]:
    - /url: /
    - img "GoodHours" [ref=e6]
  - generic [ref=e7]:
    - heading "Welcome back" [level=2] [ref=e8]
    - paragraph [ref=e9]: Sign in to your GoodHours account
    - generic [ref=e10]: Invalid email or password
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: Email
        - textbox "you@school.edu" [ref=e14]: school-admin@test.goodhours.app
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Password
          - link "Forgot password?" [ref=e18] [cursor=pointer]:
            - /url: /forgot-password
        - generic [ref=e19]:
          - textbox [ref=e20]: Playwright1!
          - button [ref=e21]:
            - img [ref=e22]
      - button "Sign In" [ref=e25]
    - generic [ref=e28]: or
    - button "Continue with Google" [ref=e30]:
      - img [ref=e31]
      - text: Continue with Google
    - generic [ref=e36]:
      - generic [ref=e37]: Dev Only
      - paragraph [ref=e38]: Bypass Google and sign in with any email domain in development.
      - generic [ref=e39]:
        - textbox "dev@any-domain.test" [ref=e40]
        - button "Dev Google" [disabled] [ref=e41]
    - paragraph [ref=e42]:
      - text: Registering a new school?
      - link "Register here" [ref=e43] [cursor=pointer]:
        - /url: /school/register
```