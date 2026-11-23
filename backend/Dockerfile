# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["Domain/SteelTrack.Domain.csproj", "Domain/"]
COPY ["Application/SteelTrack.Application.csproj", "Application/"]
COPY ["Infrastructure/SteelTrack.Infrastructure.csproj", "Infrastructure/"]
COPY ["API/SteelTrack.Api.csproj", "API/"]

RUN dotnet restore "API/SteelTrack.Api.csproj"

# Copy full source and publish
COPY . .
WORKDIR "/src/API"
RUN dotnet publish "SteelTrack.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false /p:PublishFrontend=false

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SteelTrack.Api.dll"]

