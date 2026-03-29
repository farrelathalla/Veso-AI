from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    nvidia_api_key: str
    supabase_url: str
    supabase_service_key: str
    nextjs_url: str = "http://localhost:3000"
    nextauth_secret: str
    environment: str = "development"
    tavily_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
